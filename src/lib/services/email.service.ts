import { Resend } from "resend";

/** Thin wrapper around Resend for transactional session-status emails
 * (bookings, reschedules, attendance, coach reassignment, etc -- see
 * sessionNotifications.service.ts, the only caller). Unlike zoom.service.ts
 * -- where a missing/broken integration should surface loudly, since the
 * whole point of that call is to hand back a join link the caller needs --
 * a failed notification email must never break the booking/attendance/
 * reschedule flow that triggered it, so this only ever warns, never throws.
 *
 * Requires RESEND_API_KEY and EMAIL_FROM (a verified sending address/domain
 * in the Resend dashboard, e.g. "LEANR <notifications@yourdomain.com>") in
 * env. Without them, sendEmail() logs a warning and returns false so
 * callers can no-op silently. */

let client: Resend | null | undefined;

function getClient(): Resend | null {
  if (client !== undefined) return client;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email.service] RESEND_API_KEY not set -- emails will be skipped.");
    client = null;
    return client;
  }
  client = new Resend(apiKey);
  return client;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const resend = getClient();
  const from = process.env.EMAIL_FROM;
  if (!resend || !from) {
    if (resend && !from) console.warn("[email.service] EMAIL_FROM not set -- emails will be skipped.");
    return false;
  }

  try {
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      console.warn(`[email.service] Resend rejected email to ${to}: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`[email.service] Failed to send email to ${to}:`, err instanceof Error ? err.message : err);
    return false;
  }
}
