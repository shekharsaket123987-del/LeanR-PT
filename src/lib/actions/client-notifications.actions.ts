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
