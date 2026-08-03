"use client";

import { useState } from "react";
import { Users, UserCog, CalendarDays, IndianRupee, XCircle, Download } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { isFailure } from "@/lib/actions/action-result";
import {
  generateClientReportCsvAction,
  generateCoachReportCsvAction,
  generateMonthlyReportCsvAction,
  generateRevenueReportCsvAction,
  generateCancellationReportCsvAction,
} from "@/lib/actions/admin-reports.actions";

const reports = [
  { key: "client", icon: Users, title: "Client Report", description: "Full client roster with packages, status, and coach assignments.", action: generateClientReportCsvAction, filename: "client-report.csv" },
  { key: "coach", icon: UserCog, title: "Coach Report", description: "Coach performance, utilization, ratings, and client load.", action: generateCoachReportCsvAction, filename: "coach-report.csv" },
  { key: "monthly", icon: CalendarDays, title: "Monthly PT Report", description: "Session volume, completion rate, and assessment conversions.", action: generateMonthlyReportCsvAction, filename: "monthly-pt-report.csv" },
  { key: "revenue", icon: IndianRupee, title: "Revenue Report", description: "Revenue and completed sessions by month.", action: generateRevenueReportCsvAction, filename: "revenue-report.csv" },
  { key: "cancellations", icon: XCircle, title: "Cancellation / No-Show Report", description: "Cancelled and missed sessions by client and coach.", action: generateCancellationReportCsvAction, filename: "cancellation-report.csv" },
] as const;

export default function AdminReportsClient() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  async function downloadCsv(report: (typeof reports)[number]) {
    setBusyKey(report.key);
    setError(null);
    const result = await report.action();
    setBusyKey(null);
    if (isFailure(result)) {
      setError({ key: report.key, message: result.error.message });
      return;
    }
    const blob = new Blob([result.data], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = report.filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <Card key={r.key} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/15">
            <r.icon className="h-5 w-5 text-black/70" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">{r.title}</p>
            <p className="mt-0.5 text-xs text-black/45">{r.description}</p>
            {error?.key === r.key && <p className="mt-1 text-xs text-red-600">{error.message}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" loading={busyKey === r.key} onClick={() => downloadCsv(r)}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" disabled title="PDF export not yet available">
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
