"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listClients } from "@/lib/services/clients.service";
import { listCoaches } from "@/lib/services/coaches.service";
import { listAllBookings } from "@/lib/services/bookings.service";
import { getRevenueTrendRaw } from "@/lib/services/adminDashboard.service";
import { ClientStatus, CLIENT_STATUS_LABELS } from "@/lib/client-status";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface ReportData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  csv: string;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

function toReportData(title: string, headers: string[], rows: (string | number)[][]): ReportData {
  return { title, headers, rows, csv: toCsv(headers, rows) };
}

export async function generateClientReportAction(): Promise<ActionResult<ReportData>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listClients(token);
    return toReportData(
      "Client Report",
      ["Name", "Phone", "Status", "Package", "Coach", "Sessions Remaining", "Sessions Total"],
      (rows as any[]).map((c) => [
        c.profile?.full_name ?? "",
        c.profile?.phone ?? "",
        CLIENT_STATUS_LABELS[c.clientStatus as ClientStatus] ?? c.clientStatus,
        c.activeSubscription?.package?.name ?? "",
        c.activeCoach?.profile?.full_name ?? "",
        c.activeSubscription?.sessionsRemaining ?? "",
        c.activeSubscription?.sessions_total ?? "",
      ])
    );
  });
}

export async function generateCoachReportAction(): Promise<ActionResult<ReportData>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listCoaches(token);
    return toReportData(
      "Coach Report",
      ["Name", "Specialization", "Status", "Rating", "Review Count", "Active Clients", "Utilization %"],
      (rows as any[]).map((c) => [
        c.profile?.full_name ?? "",
        c.specialization ?? "",
        c.status,
        c.rating,
        c.review_count,
        c.utilization?.active_clients ?? 0,
        c.utilization?.utilization_pct ?? 0,
      ])
    );
  });
}

export async function generateMonthlyReportAction(): Promise<ActionResult<ReportData>> {
  return runAction(async () => {
    const token = await requireToken();
    const bookings = await listAllBookings(token);
    const byMonth = new Map<string, { total: number; completed: number; assessments: number }>();
    for (const b of bookings as any[]) {
      const month = new Date(b.scheduled_start).toISOString().slice(0, 7);
      const entry = byMonth.get(month) ?? { total: 0, completed: 0, assessments: 0 };
      entry.total += 1;
      if (b.status === "completed") entry.completed += 1;
      if (b.session_type === "assessment") entry.assessments += 1;
      byMonth.set(month, entry);
    }
    const months = [...byMonth.keys()].sort();
    return toReportData(
      "Monthly PT Report",
      ["Month", "Total Sessions", "Completed", "Completion Rate %", "Assessment Sessions"],
      months.map((m) => {
        const e = byMonth.get(m)!;
        return [m, e.total, e.completed, e.total > 0 ? Math.round((e.completed / e.total) * 100) : 0, e.assessments];
      })
    );
  });
}

export async function generateRevenueReportAction(): Promise<ActionResult<ReportData>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await getRevenueTrendRaw(token);
    return toReportData(
      "Revenue Report",
      ["Month", "Revenue (Rs.)", "Completed Sessions"],
      rows.map((r) => [new Date(r.month).toISOString().slice(0, 7), r.revenue, r.sessions])
    );
  });
}

export async function generateCancellationReportAction(): Promise<ActionResult<ReportData>> {
  return runAction(async () => {
    const token = await requireToken();
    const [cancelled, missed] = await Promise.all([
      listAllBookings(token, { status: "cancelled" }),
      listAllBookings(token, { status: "missed" }),
    ]);
    const rows = [...(cancelled as any[]), ...(missed as any[])];
    return toReportData(
      "Cancellation / No-Show Report",
      ["Date", "Client", "Coach", "Status"],
      rows.map((b) => [new Date(b.scheduled_start).toISOString(), b.client?.profile?.full_name ?? "", b.coach?.profile?.full_name ?? "", b.status])
    );
  });
}
