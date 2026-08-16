import { supabaseAdmin } from "@/lib/supabase/admin-client";
import { createFromTemplate } from "./notifications.service";
import { sendEmail } from "./email.service";
import { sendSms, SmsTemplateEvent } from "./sms.service";
import { formatDate, formatTime } from "@/lib/utils";

/** Real (email/SMS) dispatch for session-lifecycle events, layered on top
 * of the existing in-app notifications.service.ts rather than replacing it
 * -- createFromTemplate() still writes the row the notification bell reads,
 * this just also sends it out. Coaches only ever get email here (never
 * SMS), matching how this was scoped: clients get email + SMS, coaches get
 * email only. A failure anywhere in this file must never break the
 * booking/attendance/reschedule flow that triggered it -- every exported
 * function swallows its own errors and just warns. */

export function formatSessionTime(iso: string): string {
  return `${formatDate(iso, { day: "2-digit", month: "short", year: "numeric" })}, ${formatTime(iso)}`;
}

export interface SessionNotifyContext {
  clientProfileId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  coachProfileId: string | null;
  coachName: string | null;
  coachEmail: string | null;
  planName: string | null;
  sessionsLeft: number | null;
}

/** clientId/coachId are client_profiles.id/coach_profiles.id (the ids every
 * booking/scheduling/coach-change call site already has in scope) -- this
 * resolves the profiles.id + contact info + current plan needed to actually
 * notify someone, in one place, so call sites don't each re-derive it. */
export async function resolveSessionNotifyContext(clientId: string, coachId?: string | null): Promise<SessionNotifyContext> {
  const [{ data: client }, coachRow, { data: sub }] = await Promise.all([
    supabaseAdmin.from("client_profiles").select("profile_id, profile:profiles(full_name, phone)").eq("id", clientId).maybeSingle(),
    coachId
      ? supabaseAdmin.from("coach_profiles").select("profile_id, profile:profiles(full_name)").eq("id", coachId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabaseAdmin.from("subscriptions").select("id, package:package_tiers(name)").eq("client_id", clientId).eq("status", "active").maybeSingle(),
  ]);

  let sessionsLeft: number | null = null;
  if (sub?.id) {
    const { data: usage } = await supabaseAdmin
      .from("subscription_usage_view")
      .select("sessions_remaining")
      .eq("subscription_id", sub.id)
      .maybeSingle();
    sessionsLeft = usage?.sessions_remaining ?? null;
  }

  const clientProfile = client as any;
  const coachProfile = (coachRow as any)?.data;

  const [clientEmail, coachEmail] = await Promise.all([
    clientProfile?.profile_id ? supabaseAdmin.auth.admin.getUserById(clientProfile.profile_id).then((r) => r.data.user?.email ?? null) : null,
    coachProfile?.profile_id ? supabaseAdmin.auth.admin.getUserById(coachProfile.profile_id).then((r) => r.data.user?.email ?? null) : null,
  ]);

  return {
    clientProfileId: clientProfile?.profile_id ?? null,
    clientName: clientProfile?.profile?.full_name ?? "Client",
    clientEmail,
    clientPhone: clientProfile?.profile?.phone ?? null,
    coachProfileId: coachProfile?.profile_id ?? null,
    coachName: coachProfile?.profile?.full_name ?? null,
    coachEmail,
    planName: (sub as any)?.package?.name ?? null,
    sessionsLeft,
  };
}

/** vars should already include whatever the template needs beyond what
 * plan_name/sessions_left contribute automatically -- e.g. {{session_time}},
 * {{coach_name}}. Pass smsEvent to also text the client (skipped
 * automatically if MSG91 or that event's DLT template isn't configured
 * yet, or the client has no phone on file). */
export async function notifyClient(
  ctx: SessionNotifyContext,
  templateKey: string,
  vars: Record<string, string>,
  smsEvent?: SmsTemplateEvent
): Promise<void> {
  if (!ctx.clientProfileId) return;
  const fullVars = { plan_name: ctx.planName ?? "N/A", sessions_left: ctx.sessionsLeft != null ? String(ctx.sessionsLeft) : "N/A", ...vars };
  try {
    const row = await createFromTemplate(templateKey, ctx.clientProfileId, fullVars);
    if (ctx.clientEmail) await sendEmail(ctx.clientEmail, row.title, `<p>${row.message}</p>`);
    if (smsEvent && ctx.clientPhone) await sendSms(smsEvent, ctx.clientPhone, fullVars);
  } catch (err) {
    console.warn(`[sessionNotifications] client notify failed (${templateKey}):`, err instanceof Error ? err.message : err);
  }
}

export async function notifyCoach(ctx: SessionNotifyContext, templateKey: string, vars: Record<string, string>): Promise<void> {
  if (!ctx.coachProfileId) return;
  const fullVars = { plan_name: ctx.planName ?? "N/A", sessions_left: ctx.sessionsLeft != null ? String(ctx.sessionsLeft) : "N/A", ...vars };
  try {
    const row = await createFromTemplate(templateKey, ctx.coachProfileId, fullVars);
    if (ctx.coachEmail) await sendEmail(ctx.coachEmail, row.title, `<p>${row.message}</p>`);
  } catch (err) {
    console.warn(`[sessionNotifications] coach notify failed (${templateKey}):`, err instanceof Error ? err.message : err);
  }
}
