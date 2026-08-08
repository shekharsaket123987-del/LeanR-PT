"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listAllBookings } from "@/lib/services/bookings.service";
import { listAdminCreatedBookingIds } from "@/lib/services/audit.service";
import { listAllShadowAssignments } from "@/lib/services/coachChange.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface SchedulingEntry {
  id: string;
  clientName: string;
  coachName: string;
  sessionType: "assessment" | "regular";
  date: string;
  status: string;
  note: string | null;
}

export interface AdminSchedulingData {
  todaysChanges: SchedulingEntry[];
  cancelled: SchedulingEntry[];
  rescheduled: SchedulingEntry[];
  manual: SchedulingEntry[];
  demo: SchedulingEntry[];
  shadow: SchedulingEntry[];
}

/** Cancellation Policy PRD §5 "Admin Dashboard" -- a grouped scheduling
 * management view, kept separate from the flat /admin/sessions master list.
 * Everything except "Manual Sessions Created" and "Shadow Sessions" is
 * derived from the same listAllBookings() rows already used elsewhere (no
 * new query shape); manual-session detection reuses the audit trigger that
 * already records who created every booking (see audit.service.ts). */
export async function getAdminSchedulingViewAction(): Promise<ActionResult<AdminSchedulingData>> {
  return runAction(async () => {
    const token = await requireToken();
    const [bookings, manualIds, shadowAssignments] = await Promise.all([
      listAllBookings(token),
      listAdminCreatedBookingIds(token),
      listAllShadowAssignments(token),
    ]);

    const manualIdSet = new Set(manualIds);
    const todayStr = new Date().toDateString();

    const toEntry = (b: any, note: string | null = null): SchedulingEntry => ({
      id: b.id,
      clientName: b.client?.profile?.full_name ?? "Client",
      coachName: b.coach?.profile?.full_name ?? "Coach",
      sessionType: b.session_type,
      date: b.scheduled_start,
      status: b.status,
      note,
    });

    const rows = bookings as any[];
    const cancelled = rows.filter((b) => b.status === "cancelled");
    const rescheduled = rows.filter((b) => b.was_rescheduled);
    const demo = rows.filter((b) => b.session_type === "assessment");
    const manual = rows.filter((b) => manualIdSet.has(b.id));

    const todaysChanges = rows.filter((b) => {
      const updatedToday = new Date(b.updated_at).toDateString() === todayStr;
      const createdToday = new Date(b.created_at).toDateString() === todayStr;
      return (b.status === "cancelled" && updatedToday) || (b.was_rescheduled && updatedToday) || createdToday;
    });

    return {
      todaysChanges: todaysChanges.map((b) => toEntry(b)),
      cancelled: cancelled.map((b) => toEntry(b, b.cancel_reason)),
      rescheduled: rescheduled.map((b) =>
        toEntry(b, b.original_scheduled_start ? `From ${new Date(b.original_scheduled_start).toLocaleString()}` : null)
      ),
      manual: manual.map((b) => toEntry(b)),
      demo: demo.map((b) => toEntry(b)),
      shadow: (shadowAssignments as any[]).map((s) => ({
        id: s.id,
        clientName: s.client?.profile?.full_name ?? "Client",
        coachName: s.shadow_coach?.profile?.full_name ?? "Coach",
        sessionType: "regular",
        date: s.starts_on,
        status: s.status,
        note: `Covering ${s.primary_coach?.profile?.full_name ?? "primary coach"} through ${s.ends_on}`,
      })),
    };
  });
}
