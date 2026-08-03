"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getBooking, getAttendanceForBooking, getWorkoutNoteForBooking } from "@/lib/services/bookings.service";
import { getEscalation } from "@/lib/services/escalations.service";
import { getLatestProgressLogBefore } from "@/lib/services/progressLogs.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface AdminSessionDetail {
  id: string;
  clientId: string;
  clientName: string;
  coachId: string;
  coachName: string;
  coachEmployeeCode: string | null;
  scheduledStart: string;
  durationMinutes: number;
  sessionType: "assessment" | "regular";
  status: "upcoming" | "completed" | "cancelled" | "missed";
  noShowParty: "client" | "coach" | null;
  technicalIssue: boolean;
  coachOnLeave: boolean;
  wasRescheduled: boolean;
  originalScheduledStart: string | null;
  cancelReason: string | null;
  wasManuallyAdded: boolean;
  attendance: {
    clientJoinedAt: string | null;
    clientLeftAt: string | null;
    coachJoinedAt: string | null;
    coachLeftAt: string | null;
  } | null;
  notes: string | null;
  homework: string | null;
  progressSnapshot: {
    loggedAt: string;
    weight: number | null;
    bodyFatPct: number | null;
    musclePct: number | null;
    waist: number | null;
    chest: number | null;
    hip: number | null;
    arms: number | null;
    thigh: number | null;
  } | null;
  escalation: { id: string; reason: string; status: "open" | "resolved" } | null;
}

export async function getAdminSessionDetailAction(bookingId: string): Promise<ActionResult<AdminSessionDetail>> {
  return runAction(async () => {
    const token = await requireToken();
    const booking: any = await getBooking(token, bookingId);

    const [attendance, workoutNote, progressLog, escalation] = await Promise.all([
      getAttendanceForBooking(token, bookingId),
      getWorkoutNoteForBooking(token, bookingId),
      getLatestProgressLogBefore(token, booking.client_id, booking.scheduled_start),
      booking.escalation_id ? getEscalation(token, booking.escalation_id) : Promise.resolve(null),
    ]);

    return {
      id: booking.id,
      clientId: booking.client_id,
      clientName: booking.client?.profile?.full_name ?? "Client",
      coachId: booking.coach_id,
      coachName: booking.coach?.profile?.full_name ?? "Coach",
      coachEmployeeCode: booking.coach?.employee_code ?? null,
      scheduledStart: booking.scheduled_start,
      durationMinutes: booking.duration_minutes,
      sessionType: booking.session_type,
      status: booking.status,
      noShowParty: booking.no_show_party,
      technicalIssue: booking.technical_issue,
      coachOnLeave: booking.coach_on_leave,
      wasRescheduled: booking.was_rescheduled,
      originalScheduledStart: booking.original_scheduled_start,
      cancelReason: booking.cancel_reason,
      wasManuallyAdded: booking.recurring_slot_id === null,
      attendance: attendance
        ? {
            clientJoinedAt: (attendance as any).client_joined_at,
            clientLeftAt: (attendance as any).client_left_at,
            coachJoinedAt: (attendance as any).coach_joined_at,
            coachLeftAt: (attendance as any).coach_left_at,
          }
        : null,
      notes: (workoutNote as any)?.notes ?? null,
      homework: (workoutNote as any)?.homework ?? null,
      progressSnapshot: progressLog
        ? {
            loggedAt: (progressLog as any).logged_at,
            weight: (progressLog as any).weight,
            bodyFatPct: (progressLog as any).body_fat_pct,
            musclePct: (progressLog as any).muscle_pct,
            waist: (progressLog as any).waist,
            chest: (progressLog as any).chest,
            hip: (progressLog as any).hip,
            arms: (progressLog as any).arms,
            thigh: (progressLog as any).thigh,
          }
        : null,
      escalation: escalation ? { id: (escalation as any).id, reason: (escalation as any).reason, status: (escalation as any).status } : null,
    };
  });
}
