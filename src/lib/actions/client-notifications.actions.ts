"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listMyNotifications, markNotificationRead } from "@/lib/services/notifications.service";

export interface NotificationView {
  id: string;
  type: "booking" | "reminder" | "feedback" | "system";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function listMyNotificationsAction(): Promise<ActionResult<NotificationView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listMyNotifications(token);
    return (rows as any[]).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      time: n.created_at,
      read: n.read,
    }));
  });
}

export async function markNotificationReadAction(notificationId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await markNotificationRead(token, notificationId);
    return null;
  });
}

export interface ShadowCoachNoticeView {
  id: string;
  message: string;
}

/** Most recent not-yet-acknowledged "shadow coach assigned" notification, if
 * any -- backs the dismissible banner on My Sessions. Deliberately just the
 * latest one rather than a list: once the client acknowledges it they've
 * seen that a shadow coach is covering them, and the per-session "Shadow
 * Coach" badge (client-portal.actions.ts) already shows which specific
 * bookings are affected, so stacking multiple banners would be redundant. */
export async function getMyShadowCoachNoticeAction(): Promise<ActionResult<ShadowCoachNoticeView | null>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listMyNotifications(token);
    const notice = (rows as any[]).find((n) => n.template_key === "shadow_coach_assigned" && !n.read);
    return notice ? { id: notice.id, message: notice.message } : null;
  });
}
