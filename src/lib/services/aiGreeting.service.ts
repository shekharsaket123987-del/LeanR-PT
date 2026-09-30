import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { getMyClientProfile } from "./clients.service";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

/** IST wall-clock time-of-day, computed independent of the server's local
 * timezone (shifting the UTC instant by the IST offset, then reading UTC
 * getters on the result, sidesteps relying on Intl/timezone data being
 * correctly configured on whatever host this runs on). LEANR is an
 * India-only PT service -- there's no per-client timezone to look up. */
export function currentTimeOfDayIST(): TimeOfDay {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000;
  const hour = new Date(istMs).getUTCHours();
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function currentDateISTString(): string {
  const istMs = Date.now() + 5.5 * 60 * 60 * 1000;
  return new Date(istMs).toISOString().slice(0, 10);
}

/** Has this client already been greeted today (IST calendar day)? Checked
 * before generating a greeting so reopening the chat panel repeatedly in
 * one day doesn't re-greet each time. */
export async function hasGreetedToday(accessToken: string): Promise<boolean> {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["client"]);
  const client = await getMyClientProfile(accessToken);
  const { data, error } = await ctx.client
    .from("ai_greetings")
    .select("id")
    .eq("client_id", (client as { id: string }).id)
    .eq("greeted_date", currentDateISTString())
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/** Claims today's greeting slot for this client -- the unique(client_id,
 * greeted_date) constraint is the actual race-safety guarantee (two
 * concurrent mount calls could both pass hasGreetedToday() before either
 * writes); the second insert here fails on conflict and the caller should
 * treat that as "someone else already greeted them," not a real error. */
export async function markGreetedToday(clientId: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from("ai_greetings").insert({ client_id: clientId, greeted_date: currentDateISTString() });
  if (error) {
    if (error.code === "23505") return false; // unique_violation -- already claimed
    throw error;
  }
  return true;
}
