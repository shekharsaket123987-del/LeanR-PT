import { supabaseAdmin } from "@/lib/supabase/admin-client";

/** PRD §15 "one toggle in AI settings pauses the AI globally or for one
 * client." A per-client row (if present and active) always wins over the
 * global row -- lets an admin resume one client early without lifting a
 * platform-wide pause. Admin read/write for the AI settings page lands in
 * Phase 4; this is the enforcement side only, called from the chat route
 * before every turn. */
export async function isAIRMPaused(clientId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin.from("ai_kill_switch").select("client_id, active").or(`client_id.eq.${clientId},client_id.is.null`);
  if (error) throw error;
  const rows = data as { client_id: string | null; active: boolean }[];
  const clientRow = rows.find((r) => r.client_id === clientId);
  if (clientRow) return clientRow.active;
  const globalRow = rows.find((r) => r.client_id === null);
  return globalRow?.active ?? false;
}

/** Shown in the chat panel while paused, and as the transcript text -- PRD
 * §15's exact copy. */
export const AI_RM_PAUSED_REPLY = "Our team will reply to you here shortly.";
