import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { createFromTemplate } from "./notifications.service";

export type ConversationCategory = "active" | "old" | "expired" | "pause";

export interface ConversationParticipantView {
  id: string;
  name: string;
  photo: string;
}

export interface MessageView {
  id: string;
  conversationId: string;
  senderRole: "client" | "coach";
  senderProfileId: string;
  body: string;
  attachmentUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

const FALLBACK_PHOTO = (seed: string) => `https://i.pravatar.cc/300?u=${seed}`;

/** Idempotent: keeps a client's ONE open conversation pointed at their
 * current coach. Called as a side effect of every code path that actually
 * changes a client's coach (scheduling.service.ts::createRecurringSlots,
 * clients.service.ts::reassignClientCoach) -- never invoked directly by a
 * portal action. If the client already has an open conversation with a
 * DIFFERENT coach, that one is closed (frozen, read-only forever after --
 * see migration 0042's messages_insert_participant policy) and a fresh one
 * opens with the new coach; same-coach calls are a no-op. Uses supabaseAdmin
 * throughout (same shape as timeline.service.ts::logTimelineEvent) since
 * conversations have no client/coach write policy at all -- this is the only
 * thing allowed to create or close one. No-ops for a client who has never
 * purchased a plan; chat only exists post-payment. */
export async function ensureConversationForCoachAssignment(clientId: string, newCoachId: string): Promise<void> {
  const { data: anySub, error: subError } = await supabaseAdmin.from("subscriptions").select("id").eq("client_id", clientId).limit(1);
  if (subError) throw subError;
  if (!anySub || anySub.length === 0) return;

  const { data: active, error: activeError } = await supabaseAdmin
    .from("conversations")
    .select("id, coach_id")
    .eq("client_id", clientId)
    .eq("status", "active")
    .maybeSingle();
  if (activeError) throw activeError;

  if (active?.coach_id === newCoachId) return;

  if (active) {
    const { error: closeError } = await supabaseAdmin
      .from("conversations")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", active.id);
    if (closeError) throw closeError;
  }

  const { error: insertError } = await supabaseAdmin
    .from("conversations")
    .insert({ client_id: clientId, coach_id: newCoachId, status: "active" });
  if (insertError) throw insertError;
}

export interface ClientConversationView {
  id: string;
  status: "active" | "closed";
  openedAt: string;
  closedAt: string | null;
  coach: ConversationParticipantView;
  unreadCount: number;
}

/** One batched query for unread counts across a set of conversations --
 * "unread" means a message from the OTHER role with no read_at yet. Shared
 * by both listMyConversationsAs* functions below (just fed the opposite
 * "other role"). */
async function unreadCountsByConversation(
  ctx: Awaited<ReturnType<typeof getCallerContext>>,
  conversationIds: string[],
  otherRole: "client" | "coach"
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (conversationIds.length === 0) return counts;
  const { data, error } = await ctx.client
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .eq("sender_role", otherRole)
    .is("read_at", null);
  if (error) throw error;
  for (const m of (data ?? []) as any[]) counts.set(m.conversation_id, (counts.get(m.conversation_id) ?? 0) + 1);
  return counts;
}

export async function listMyConversationsAsClient(accessToken: string): Promise<ClientConversationView[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) throw clientError ?? new Error("Client profile not found");

  const { data, error } = await ctx.client
    .from("conversations")
    .select("id, status, opened_at, closed_at, coach:coach_profiles(id, profile:profiles(full_name, photo_url))")
    .eq("client_id", client.id)
    .order("opened_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as any[];
  const unread = await unreadCountsByConversation(ctx, rows.map((c) => c.id), "coach");

  return rows.map((c) => ({
    id: c.id,
    status: c.status,
    openedAt: c.opened_at,
    closedAt: c.closed_at,
    coach: {
      id: c.coach?.id ?? "",
      name: c.coach?.profile?.full_name ?? "Coach",
      photo: c.coach?.profile?.photo_url ?? FALLBACK_PHOTO(c.coach?.id ?? "coach"),
    },
    unreadCount: unread.get(c.id) ?? 0,
  }));
}

/** Nav-badge total -- sum of unread across every conversation. Reuses the
 * list function rather than duplicating the query; the extra shape-mapping
 * cost is negligible for a once-per-layout-render fetch. */
export async function getMyTotalUnreadAsClient(accessToken: string): Promise<number> {
  const conversations = await listMyConversationsAsClient(accessToken);
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

/** Cheap existence check backing the client portal's "My Chats" nav item --
 * shown once a conversation has ever been opened, even if it's since closed
 * (there's still history worth seeing). */
export async function clientHasAnyConversation(accessToken: string): Promise<boolean> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data: client, error: clientError } = await ctx.client.from("client_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (clientError || !client) return false;
  const { data, error } = await ctx.client.from("conversations").select("id").eq("client_id", client.id).limit(1);
  if (error) throw error;
  return (data ?? []).length > 0;
}

export interface CoachConversationView {
  id: string;
  status: "active" | "closed";
  category: ConversationCategory;
  openedAt: string;
  closedAt: string | null;
  client: ConversationParticipantView & { clientCode: string | null };
  unreadCount: number;
}

/** Every conversation this coach has ever had (current + past clients),
 * each labeled into the 4-way inbox filter: a CLOSED conversation (this
 * coach was replaced) is always "old" regardless of the client's plan
 * status; otherwise it's derived from that client's latest subscription --
 * paused -> "pause", active/awaiting_activation -> "active", anything else
 * (inactive, or no subscription row at all) -> "expired". One batched
 * subscriptions query for every client involved, not one per row. */
export async function listMyConversationsAsCoach(accessToken: string): Promise<CoachConversationView[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data: coach, error: coachError } = await ctx.client.from("coach_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");

  const { data, error } = await ctx.client
    .from("conversations")
    .select("id, status, opened_at, closed_at, client:client_profiles(id, client_code, profile:profiles(full_name, photo_url))")
    .eq("coach_id", coach.id)
    .order("opened_at", { ascending: false });
  if (error) throw error;

  const conversations = (data ?? []) as any[];
  const clientIds = [...new Set(conversations.map((c) => c.client?.id).filter(Boolean))];
  const { data: subs, error: subsError } =
    clientIds.length > 0
      ? await ctx.client.from("subscriptions").select("client_id, status, created_at").in("client_id", clientIds)
      : { data: [] as any[], error: null };
  if (subsError) throw subsError;

  const latestSubByClient = new Map<string, { status: string; created_at: string }>();
  for (const s of (subs ?? []) as any[]) {
    const existing = latestSubByClient.get(s.client_id);
    if (!existing || new Date(s.created_at) > new Date(existing.created_at)) latestSubByClient.set(s.client_id, s);
  }

  const unread = await unreadCountsByConversation(ctx, conversations.map((c) => c.id), "client");

  return conversations.map((c) => {
    const clientId = c.client?.id ?? "";
    const subStatus = latestSubByClient.get(clientId)?.status;
    let category: ConversationCategory;
    if (c.status === "closed") category = "old";
    else if (subStatus === "paused") category = "pause";
    else if (subStatus === "active" || subStatus === "awaiting_activation") category = "active";
    else category = "expired";

    return {
      id: c.id,
      status: c.status,
      category,
      openedAt: c.opened_at,
      closedAt: c.closed_at,
      client: {
        id: clientId,
        clientCode: c.client?.client_code ?? null,
        name: c.client?.profile?.full_name ?? "Client",
        photo: c.client?.profile?.photo_url ?? FALLBACK_PHOTO(clientId),
      },
      unreadCount: unread.get(c.id) ?? 0,
    };
  });
}

/** Nav-badge total for the coach portal, same reasoning as the client-side
 * getMyTotalUnreadAsClient. */
export async function getMyTotalUnreadAsCoach(accessToken: string): Promise<number> {
  const conversations = await listMyConversationsAsCoach(accessToken);
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

function toMessageView(m: any): MessageView {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderRole: m.sender_role,
    senderProfileId: m.sender_profile_id,
    body: m.body ?? "",
    attachmentUrl: m.attachment_url ?? null,
    readAt: m.read_at ?? null,
    createdAt: m.created_at,
  };
}

const MESSAGE_SELECT = "id, conversation_id, sender_role, sender_profile_id, body, attachment_url, read_at, created_at";

/** RLS decides visibility -- a participant (client, current coach, or a
 * former coach reading their own frozen thread) sees the full history;
 * anyone else's query simply returns no rows. */
export async function listMessages(accessToken: string, conversationId: string): Promise<MessageView[]> {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("messages")
    .select(MESSAGE_SELECT)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(toMessageView);
}

/** RLS is the real gate here (messages_insert_participant, migration 0042):
 * rejects the insert outright if the conversation is closed, or the caller
 * isn't its current client/coach -- this function doesn't re-check either,
 * it just surfaces whatever error RLS raises. attachmentUrl makes an
 * image-only message valid (migration 0044 relaxed the body constraint to
 * require either one). Notifying the recipient is best-effort: a failure
 * there (e.g. a stray null profile id) must never fail the send itself. */
export async function sendMessage(accessToken: string, conversationId: string, body: string, attachmentUrl?: string): Promise<MessageView> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client", "coach"]);
  const trimmed = body.trim();
  if (!trimmed && !attachmentUrl) throw new Error("Message can't be empty");

  const { data, error } = await ctx.client
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_role: ctx.role as "client" | "coach",
      sender_profile_id: ctx.userId,
      body: trimmed || null,
      attachment_url: attachmentUrl ?? null,
    })
    .select(MESSAGE_SELECT)
    .single();
  if (error) throw error;

  try {
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select(
        "client:client_profiles(profile_id, profile:profiles(full_name)), coach:coach_profiles(profile_id, profile:profiles(full_name))"
      )
      .eq("id", conversationId)
      .maybeSingle();
    const recipientProfileId = ctx.role === "client" ? (conv as any)?.coach?.profile_id : (conv as any)?.client?.profile_id;
    const senderName =
      ctx.role === "client" ? (conv as any)?.client?.profile?.full_name : (conv as any)?.coach?.profile?.full_name;
    if (recipientProfileId) {
      await createFromTemplate("new_chat_message", recipientProfileId, {
        sender_name: senderName ?? (ctx.role === "client" ? "Your client" : "Your coach"),
        preview: trimmed ? (trimmed.length > 80 ? `${trimmed.slice(0, 80)}...` : trimmed) : "📷 Photo",
      });
    }
  } catch {
    // Best-effort -- the message itself already sent successfully.
  }

  return toMessageView(data);
}

/** Marks every unread message from the OTHER participant as read -- called
 * when a conversation's thread is open and visible. RLS (messages_mark_read,
 * migration 0044) only allows this for a genuine participant, and only on
 * the other side's messages, so this can't be used to mark your own sent
 * messages "read." */
export async function markConversationRead(accessToken: string, conversationId: string): Promise<void> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client", "coach"]);
  const otherRole: "client" | "coach" = ctx.role === "client" ? "coach" : "client";
  const { error } = await ctx.client
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("sender_role", otherRole)
    .is("read_at", null);
  if (error) throw error;
}

export interface AdminConversationView {
  id: string;
  status: "active" | "closed";
  openedAt: string;
  closedAt: string | null;
  coach: ConversationParticipantView;
  messages: MessageView[];
}

/** Admin-only full history for one client, every coach they've ever had,
 * oldest first -- backs the "Chats" panel on the admin client-detail page.
 * Full message bodies are fetched here (unlike the list views above), since
 * this is the one place meant to show complete conversations, not just a
 * roster to click into. */
export async function listAllConversationsForClient(accessToken: string, clientId: string): Promise<AdminConversationView[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const { data, error } = await ctx.client
    .from("conversations")
    .select("id, status, opened_at, closed_at, coach:coach_profiles(id, profile:profiles(full_name, photo_url))")
    .eq("client_id", clientId)
    .order("opened_at", { ascending: true });
  if (error) throw error;

  const conversations = (data ?? []) as any[];
  const { data: messages, error: messagesError } =
    conversations.length > 0
      ? await ctx.client
          .from("messages")
          .select(MESSAGE_SELECT)
          .in(
            "conversation_id",
            conversations.map((c) => c.id)
          )
          .order("created_at", { ascending: true })
      : { data: [] as any[], error: null };
  if (messagesError) throw messagesError;

  const messagesByConversation = new Map<string, MessageView[]>();
  for (const m of (messages ?? []) as any[]) {
    const list = messagesByConversation.get(m.conversation_id) ?? [];
    list.push(toMessageView(m));
    messagesByConversation.set(m.conversation_id, list);
  }

  return conversations.map((c) => ({
    id: c.id,
    status: c.status,
    openedAt: c.opened_at,
    closedAt: c.closed_at,
    coach: {
      id: c.coach?.id ?? "",
      name: c.coach?.profile?.full_name ?? "Coach",
      photo: c.coach?.profile?.photo_url ?? FALLBACK_PHOTO(c.coach?.id ?? "coach"),
    },
    messages: messagesByConversation.get(c.id) ?? [],
  }));
}
