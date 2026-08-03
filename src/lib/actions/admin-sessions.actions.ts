"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listAllBookings, rescheduleBooking, cancelBooking } from "@/lib/services/bookings.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface AdminSessionView {
  id: string;
  clientName: string;
  coachId: string;
  coachName: string;
  date: string;
  durationMinutes: number;
  type: "assessment" | "regular";
  status: "upcoming" | "completed" | "cancelled" | "missed";
}

export async function listAdminSessionsAction(filters?: { coachId?: string; status?: string }): Promise<ActionResult<AdminSessionView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listAllBookings(token, filters);
    return (rows as any[]).map((b) => ({
      id: b.id,
      clientName: b.client?.profile?.full_name ?? "Client",
      coachId: b.coach?.id ?? "",
      coachName: b.coach?.profile?.full_name ?? "Coach",
      date: b.scheduled_start,
      durationMinutes: b.duration_minutes,
      type: b.session_type,
      status: b.status,
    }));
  });
}

export async function rescheduleSessionAction(bookingId: string, newStart: string, newDurationMinutes?: number): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await rescheduleBooking(token, bookingId, newStart, newDurationMinutes);
    return null;
  });
}

export async function cancelSessionAction(bookingId: string, reason?: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await cancelBooking(token, bookingId, reason);
    return null;
  });
}
