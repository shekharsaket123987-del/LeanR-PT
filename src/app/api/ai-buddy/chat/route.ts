import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/supabase/server-client";
import { buildAIBuddyContext } from "@/lib/services/aiBuddyContext.service";
import {
  listRecentAIBuddyMessages,
  insertAIBuddyMessage,
  attachEscalationToMessage,
  insertAIAuditLog,
} from "@/lib/services/aiBuddyMessages.service";
import { runAIBuddyTurn, ConcernProposal } from "@/lib/services/aiBuddyChat.service";
import { preCheckMessage, postCheckReply, L3_FIXED_REPLY, POST_CHECK_FALLBACK_REPLY } from "@/lib/services/aiBuddySafety.service";
import { isAIRMPaused, AI_RM_PAUSED_REPLY } from "@/lib/services/aiKillSwitch.service";
import { insertMemoryNote } from "@/lib/services/aiMemoryNotes.service";
import { createEscalation } from "@/lib/services/escalations.service";
import { getMyClientProfile, getMyCurrentCoachId } from "@/lib/services/clients.service";

export const dynamic = "force-dynamic";

/** Auto-raises a concern server-side and links it back to the assistant
 * message that triggered it -- shared by the pre-check (L3), kill-switch
 * (paused), and post-check (blocked draft) paths, which all need the same
 * "file it now, don't wait for a client click" behaviour (PRD §11.1: L3
 * "raises without asking and tells the client"; §15 kill switch: "new
 * messages become concerns"; §13.1 DO-NOT #9: never hide or delay a serious
 * concern). Never throws -- a failure here shouldn't stop the client from
 * seeing the safe reply, so it's logged and swallowed. */
async function autoRaiseConcern(params: {
  token: string;
  clientId: string;
  coachId: string | null;
  assistantMessageId: string;
  proposal: ConcernProposal;
  triggerRule: string;
  aiSummary: string;
}): Promise<ConcernProposal> {
  const proposal: ConcernProposal = { ...params.proposal, autoRaised: true, triggerRule: params.triggerRule };
  try {
    const escalation = await createEscalation(params.token, {
      clientId: params.clientId,
      coachId: params.coachId ?? undefined,
      reason: proposal.reason,
      description: proposal.description,
      category: proposal.category,
      source: "ai_rm",
      level: proposal.level as "L1" | "L2" | "L3" | undefined,
      triggerRule: params.triggerRule,
      aiSummary: params.aiSummary,
      aiChatMessageId: params.assistantMessageId,
    });
    proposal.escalationId = escalation.id;
    await attachEscalationToMessage(params.assistantMessageId, proposal);
  } catch (err) {
    console.error("[ai-buddy] auto-raise concern failed:", err instanceof Error ? err.message : err);
  }
  return proposal;
}

/** Client-portal AI Relationship Manager chat turn. Authenticates the caller
 * via the same cookie-based session every server action already uses (never
 * trusts a client_id from the request body). Runs entirely non-streamed:
 * the pre-check (layer 2) can short-circuit before the model is ever
 * called, and the post-check (layer 4) must see the *complete* draft before
 * any of it reaches the client -- neither is possible with token-by-token
 * streaming, so this trades perceived latency for the "0 unsafe replies"
 * requirement (AI_RM_prd.md §17.3). */
export async function POST(request: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let message = "";
  try {
    const body = await request.json();
    message = typeof body?.message === "string" ? body.message.trim() : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Message can't be empty" }, { status: 400 });

  let clientId: string;
  let coachId: string | null;
  try {
    const [client, resolvedCoachId] = await Promise.all([getMyClientProfile(token), getMyCurrentCoachId(token)]);
    clientId = (client as { id: string }).id;
    coachId = resolvedCoachId ?? null;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to resolve client" }, { status: 500 });
  }

  await insertAIBuddyMessage(clientId, "user", message);

  // ── Layer 2: pre-check, before the model is ever called ──
  const preCheck = preCheckMessage(message);
  if (preCheck.triggered) {
    const assistantMessageId = await insertAIBuddyMessage(clientId, "assistant", L3_FIXED_REPLY, {
      category: preCheck.category!,
      reason: "Possible pain, injury or medical/safety concern",
      description: message,
      level: "L3",
    });
    const proposal = await autoRaiseConcern({
      token,
      clientId,
      coachId,
      assistantMessageId,
      proposal: { category: preCheck.category!, reason: "Possible pain, injury or medical/safety concern", description: message, level: "L3" },
      triggerRule: preCheck.matchedRule!,
      aiSummary: "AI RM pre-check flagged this message before any reply was generated.",
    });
    await insertAIAuditLog({
      clientId,
      messageId: assistantMessageId,
      level: "L3",
      preCheckTriggered: true,
      postCheckBlocked: false,
      concernId: proposal.escalationId ?? null,
    });
    return NextResponse.json({ text: L3_FIXED_REPLY, concernProposal: proposal, messageId: assistantMessageId });
  }

  // ── Kill switch (PRD §15) -- checked after safety, before the model ──
  if (await isAIRMPaused(clientId)) {
    const assistantMessageId = await insertAIBuddyMessage(clientId, "assistant", AI_RM_PAUSED_REPLY, {
      category: "other",
      reason: "Message received while AI RM is paused",
      description: message,
      level: "L2",
    });
    const proposal = await autoRaiseConcern({
      token,
      clientId,
      coachId,
      assistantMessageId,
      proposal: { category: "other", reason: "Message received while AI RM is paused", description: message, level: "L2" },
      triggerRule: "R-KILL-SWITCH-PAUSED",
      aiSummary: "AI RM is paused for this client; message forwarded for a human reply.",
    });
    await insertAIAuditLog({
      clientId,
      messageId: assistantMessageId,
      level: "L2",
      preCheckTriggered: false,
      postCheckBlocked: false,
      concernId: proposal.escalationId ?? null,
    });
    return NextResponse.json({ text: AI_RM_PAUSED_REPLY, concernProposal: proposal, messageId: assistantMessageId });
  }

  // ── Normal turn ──
  let contextText: string;
  let history: { role: "user" | "assistant"; content: string }[];
  try {
    const [context, recent] = await Promise.all([buildAIBuddyContext(token), listRecentAIBuddyMessages(token)]);
    contextText = context.contextText;
    history = recent.map((h) => ({ role: h.role, content: h.content }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load your context" }, { status: 500 });
  }

  let text: string;
  let concernProposal: ConcernProposal | null;
  let memoryNoteContent: string | null;
  try {
    const result = await runAIBuddyTurn({ contextText, history, userMessage: message });
    text = result.text;
    concernProposal = result.concernProposal;
    memoryNoteContent = result.memoryNoteContent;
  } catch (err) {
    const errorText = err instanceof Error ? err.message : "AI Relationship Manager couldn't respond right now.";
    await insertAIBuddyMessage(clientId, "assistant", `(error) ${errorText}`).catch(() => {});
    return NextResponse.json({ error: errorText }, { status: 502 });
  }

  // ── Layer 4: post-check, before anything is persisted or sent ──
  const postCheck = postCheckReply(text || "");
  if (postCheck.blocked) {
    const fallbackProposal: ConcernProposal = concernProposal ?? {
      category: "other",
      reason: "Needs team review",
      description: message,
      level: "L2",
    };
    const assistantMessageId = await insertAIBuddyMessage(clientId, "assistant", POST_CHECK_FALLBACK_REPLY, fallbackProposal);
    const proposal = await autoRaiseConcern({
      token,
      clientId,
      coachId,
      assistantMessageId,
      proposal: fallbackProposal,
      triggerRule: `POST-CHECK-${postCheck.reason}`,
      aiSummary: "The AI's drafted reply was blocked by the post-check safety layer before it reached the client.",
    });
    await insertAIAuditLog({
      clientId,
      messageId: assistantMessageId,
      level: (fallbackProposal.level as "L0" | "L1" | "L2" | "L3") ?? "L2",
      preCheckTriggered: false,
      postCheckBlocked: true,
      concernId: proposal.escalationId ?? null,
    });
    return NextResponse.json({ text: POST_CHECK_FALLBACK_REPLY, concernProposal: proposal, messageId: assistantMessageId });
  }

  const assistantMessageId = await insertAIBuddyMessage(clientId, "assistant", text || "Let me get our team to help with this one.", concernProposal);
  if (memoryNoteContent) {
    await insertMemoryNote(clientId, memoryNoteContent, assistantMessageId).catch((err) => {
      console.error("[ai-buddy] failed to save memory note:", err instanceof Error ? err.message : err);
    });
  }
  await insertAIAuditLog({
    clientId,
    messageId: assistantMessageId,
    level: (concernProposal?.level as "L0" | "L1" | "L2" | "L3" | undefined) ?? "L0",
    preCheckTriggered: false,
    postCheckBlocked: false,
    concernId: null,
  });

  return NextResponse.json({ text, concernProposal, messageId: assistantMessageId });
}
