import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import type { ConcernProposal } from "./aiBuddyChat.service";

export interface AIBuddyMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  concern_proposal: ConcernProposal | null;
  /** True on an assistant turn that's asking for the weekly rating -- the
   * chat panel renders the rating widget under it instead of plain text. */
  rating_request: boolean;
  created_at: string;
}

/** RLS-scoped read of the caller's own transcript (ai_buddy_messages_select_own). */
export async function listMyAIBuddyMessages(accessToken: string): Promise<AIBuddyMessageRow[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data, error } = await ctx.client
    .from("ai_buddy_messages")
    .select("id, role, content, concern_proposal, rating_request, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as AIBuddyMessageRow[];
}

/** Recent turns for prompt history -- capped so a long-running conversation
 * doesn't grow the request payload unbounded. */
export async function listRecentAIBuddyMessages(accessToken: string, limit = 20): Promise<AIBuddyMessageRow[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data, error } = await ctx.client
    .from("ai_buddy_messages")
    .select("id, role, content, concern_proposal, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as AIBuddyMessageRow[]).reverse();
}

/** System-written only (no client/coach insert RLS policy) -- called from
 * the chat route handler after it has already authenticated the caller and
 * resolved their own client_id, and from the nudge cron for proactive
 * messages. Mirrors client_timeline_events' logTimelineEvent() pattern. */
export async function insertAIBuddyMessage(
  clientId: string,
  role: "user" | "assistant",
  content: string,
  concernProposal?: ConcernProposal | null,
  options?: { ratingRequest?: boolean }
): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("ai_buddy_messages")
    .insert({
      client_id: clientId,
      role,
      content,
      concern_proposal: concernProposal ?? null,
      rating_request: options?.ratingRequest ?? false,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Patches in the escalation id once an auto-raised concern (pre-check L3
 * hit, post-check block, or a dedupe match) has actually been filed -- the
 * message is written first to get a stable id to link the escalation back
 * to, so this closes the loop the other direction so the chat card can
 * render "already raised" instead of a confirm button. */
export async function attachEscalationToMessage(messageId: string, proposal: ConcernProposal) {
  const { error } = await supabaseAdmin.from("ai_buddy_messages").update({ concern_proposal: proposal }).eq("id", messageId);
  if (error) throw error;
}

/** One row per assistant turn (PRD §8.2 FR-15, §13.1 layers 2/4) -- what the
 * safety layers decided, independent of the transcript text itself. */
export async function insertAIAuditLog(input: {
  clientId: string;
  messageId: string | null;
  level: "L0" | "L1" | "L2" | "L3" | null;
  preCheckTriggered: boolean;
  postCheckBlocked: boolean;
  concernId: string | null;
}) {
  const { error } = await supabaseAdmin.from("ai_audit_log").insert({
    client_id: input.clientId,
    message_id: input.messageId,
    level: input.level,
    pre_check_triggered: input.preCheckTriggered,
    post_check_blocked: input.postCheckBlocked,
    concern_id: input.concernId,
  });
  if (error) throw error;
}
