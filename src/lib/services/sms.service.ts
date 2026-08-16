/** Thin wrapper around MSG91's Flow API (template-based SMS) for
 * transactional session-status texts to clients (see
 * sessionNotifications.service.ts, the only caller) -- coaches get email
 * only, never SMS, per how this was scoped.
 *
 * India requires every transactional SMS to go through a DLT-registered
 * template (TRAI regulation, not an MSG91 quirk) -- a plain freeform
 * message body, even via a legitimate provider, gets silently dropped for
 * Indian numbers without one. That's an external step only the account
 * owner can do (register each template's exact wording with MSG91, get it
 * DLT-approved, then set its template ID below) -- this wrapper can't paper
 * over it. Until MSG91_TEMPLATE_ID_<EVENT> is set for a given event type,
 * sendSms() for that event logs a warning and returns false, same
 * fail-soft contract as email.service.ts.
 *
 * Requires MSG91_AUTH_KEY in env, plus one MSG91_TEMPLATE_ID_* per event
 * (see SmsTemplateEvent below) once each template is DLT-approved in the
 * MSG91 dashboard. Each template's variables must be named to match what
 * sessionNotifications.service.ts passes as `variables` here (MSG91 Flow
 * placeholders are usually written as ##var_name## in the template body). */

export type SmsTemplateEvent =
  | "session_booked"
  | "demo_booked"
  | "schedule_changed"
  | "coach_changed"
  | "attendance_present"
  | "attendance_absent"
  | "session_rescheduled";

const TEMPLATE_ENV_VAR: Record<SmsTemplateEvent, string> = {
  session_booked: "MSG91_TEMPLATE_ID_SESSION_BOOKED",
  demo_booked: "MSG91_TEMPLATE_ID_DEMO_BOOKED",
  schedule_changed: "MSG91_TEMPLATE_ID_SCHEDULE_CHANGED",
  coach_changed: "MSG91_TEMPLATE_ID_COACH_CHANGED",
  attendance_present: "MSG91_TEMPLATE_ID_ATTENDANCE_PRESENT",
  attendance_absent: "MSG91_TEMPLATE_ID_ATTENDANCE_ABSENT",
  session_rescheduled: "MSG91_TEMPLATE_ID_SESSION_RESCHEDULED",
};

function normalizeMobile(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  // MSG91 expects country code with no leading '+' -- assume India (91) for
  // a bare 10-digit number, same default the rest of the app makes for phone
  // input (SignupForm.tsx's placeholder, PhoneGateModal.tsx).
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function sendSms(event: SmsTemplateEvent, to: string, variables: Record<string, string>): Promise<boolean> {
  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    console.warn("[sms.service] MSG91_AUTH_KEY not set -- SMS will be skipped.");
    return false;
  }
  const templateId = process.env[TEMPLATE_ENV_VAR[event]];
  if (!templateId) {
    console.warn(`[sms.service] ${TEMPLATE_ENV_VAR[event]} not set (DLT template not configured yet) -- SMS for "${event}" skipped.`);
    return false;
  }

  try {
    const res = await fetch("https://control.msg91.com/api/v5/flow/", {
      method: "POST",
      headers: { authkey: authKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "0",
        recipients: [{ mobiles: normalizeMobile(to), ...variables }],
      }),
    });
    if (!res.ok) {
      console.warn(`[sms.service] MSG91 rejected SMS to ${to} (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[sms.service] Failed to send SMS to ${to}:`, err instanceof Error ? err.message : err);
    return false;
  }
}
