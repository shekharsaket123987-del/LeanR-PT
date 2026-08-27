import { getCallerContext } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { sendEmail } from "./email.service";

export async function listMyNotifications(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("notifications")
    .select("*")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function markNotificationRead(accessToken: string, notificationId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", ctx.userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** System-level: called internally after privileged operations (booking
 * confirmed/cancelled, coach change resolved, etc). Uses the admin client
 * since it needs to write notifications for a DIFFERENT user than whoever
 * triggered the action. Not exposed directly to any portal. */
export async function createFromTemplate(templateKey: string, userId: string, vars: Record<string, string> = {}) {
  const { data: template, error: templateError } = await supabaseAdmin
    .from("notification_templates")
    .select("*")
    .eq("key", templateKey)
    .single();
  if (templateError || !template) throw templateError ?? new Error(`Unknown notification template: ${templateKey}`);

  const interpolate = (s: string) => s.replace(/{{(\w+)}}/g, (_, key) => vars[key] ?? "");

  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert({
      user_id: userId,
      template_key: templateKey,
      type: template.type,
      title: interpolate(template.title_template),
      message: interpolate(template.body_template),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Generic single-user notify: writes the in-app row via createFromTemplate
 * AND emails them -- for events that don't fit the client/coach-pair shape
 * sessionNotifications.service.ts's notifyClient/notifyCoach expect (a
 * coach's own leave approval, a shadow-coach assignment, an escalation),
 * where there's exactly one recipient and no "client's active plan" context
 * to resolve. Same fail-soft contract as everything else here -- a broken
 * email must never break the flow that triggered it. */
export async function notifyUser(profileId: string, templateKey: string, vars: Record<string, string> = {}) {
  try {
    const row = await createFromTemplate(templateKey, profileId, vars);
    const { data } = await supabaseAdmin.auth.admin.getUserById(profileId);
    const email = data.user?.email;
    if (email) await sendEmail(email, row.title, `<p>${row.message}</p>`);
  } catch (err) {
    console.warn(`[notifications] notifyUser failed (${templateKey}):`, err instanceof Error ? err.message : err);
  }
}

/** Notifies every admin profile via a template — used when an automated flow
 * (e.g. recurring-schedule matching) exhausts its options and needs a human
 * to resolve it manually. There's no dedicated "operations inbox" concept
 * yet, so every admin gets the notification. */
export async function notifyAdmins(templateKey: string, vars: Record<string, string> = {}) {
  const { data: admins, error } = await supabaseAdmin.from("profiles").select("id").eq("role", "admin");
  if (error) throw error;
  await Promise.all((admins ?? []).map((a) => createFromTemplate(templateKey, a.id, vars)));
}
