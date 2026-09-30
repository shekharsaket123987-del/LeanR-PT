import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

export interface AIMemoryNoteRow {
  id: string;
  content: string;
  expires_at: string;
  created_at: string;
}

/** Client's own notes, unexpired only -- what the AI Chat panel and the
 * context builder both use ("what does the AI currently remember about me").
 * Expired rows are left in place (admin can still see history via
 * listMemoryNotesForClient) rather than deleted on read. */
export async function listMyActiveMemoryNotes(accessToken: string): Promise<AIMemoryNoteRow[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const { data, error } = await ctx.client
    .from("ai_memory_notes")
    .select("id, content, expires_at, created_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as AIMemoryNoteRow[];
}

/** Admin/coach view from the client profile's AI Chat tab (PRD §15) --
 * includes expired notes so staff can see the full history, not just what's
 * currently live in the AI's context. */
export async function listMemoryNotesForClient(accessToken: string, clientId: string): Promise<AIMemoryNoteRow[]> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await supabaseAdmin
    .from("ai_memory_notes")
    .select("id, content, expires_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as AIMemoryNoteRow[];
}

/** System-written only, same pattern as insertAIBuddyMessage -- called from
 * the chat route after the model calls save_memory_note. clientId is always
 * the caller's own resolved id, never taken from the model's tool input. */
export async function insertMemoryNote(clientId: string, content: string, sourceMessageId: string | null, expiresAt?: string) {
  const { error } = await supabaseAdmin.from("ai_memory_notes").insert({
    client_id: clientId,
    content,
    source_message_id: sourceMessageId,
    ...(expiresAt ? { expires_at: expiresAt } : {}),
  });
  if (error) throw error;
}

/** "Forget that" (client, via the chat) or manual cleanup (admin, via the AI
 * Chat tab) -- both delete outright rather than just letting it expire,
 * since the PRD requires "the AI confirms" the note is gone, not just that
 * it stops being read next turn. */
export async function deleteMemoryNote(accessToken: string, noteId: string) {
  const ctx = await getCallerContext(accessToken);
  if (ctx.role === "client") {
    // Scoped by the ai_memory_notes_delete_own RLS policy (client_id =
    // my_client_id()) -- ctx.userId is the auth/profiles id, not
    // client_profiles.id, so it can't be used as an explicit filter here.
    const { error } = await ctx.client.from("ai_memory_notes").delete().eq("id", noteId);
    if (error) throw error;
    return;
  }
  requireRole(ctx, ["admin"]);
  const { error } = await supabaseAdmin.from("ai_memory_notes").delete().eq("id", noteId);
  if (error) throw error;
}
