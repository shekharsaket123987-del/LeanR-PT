"use client";

import { useState } from "react";
import { Users, UserCog, CalendarDays, IndianRupee, XCircle, Download, FileText } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { isFailure } from "@/lib/actions/action-result";
import {
  ReportData,
  generateClientReportAction,
  generateCoachReportAction,
  generateMonthlyReportAction,
  generateRevenueReportAction,
  generateCancellationReportAction,
} from "@/lib/actions/admin-reports.actions";

const reports = [
  { key: "client", icon: Users, title: "Client Report", description: "Full client roster with packages, status, and coach assignments.", action: generateClientReportAction, filename: "client-report" },
  { key: "coach", icon: UserCog, title: "Coach Report", description: "Coach performance, utilization, ratings, and client load.", action: generateCoachReportAction, filename: "coach-report" },
  { key: "monthly", icon: CalendarDays, title: "Monthly PT Report", description: "Session volume, completion rate, and assessment conversions.", action: generateMonthlyReportAction, filename: "monthly-pt-report" },
  { key: "revenue", icon: IndianRupee, title: "Revenue Report", description: "Revenue and completed sessions by month.", action: generateRevenueReportAction, filename: "revenue-report" },
  { key: "cancellations", icon: XCircle, title: "Cancellation / No-Show Report", description: "Cancelled and missed sessions by client and coach.", action: generateCancellationReportAction, filename: "cancellation-report" },
] as const;

function downloadCsv(data: ReportData, filename: string) {
  const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Client-side PDF generation (jsPDF + jspdf-autotable) -- no server-side
 * renderer, matching the app's existing client-driven CSV export pattern.
 * Dynamically imported so the ~200KB of PDF libraries only load if an admin
 * actually clicks a PDF button, not on every /admin/reports page load. */
async function downloadPdf(data: ReportData, filename: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(data.title, 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${new Date().toLocaleString()}`, 14, 22);
  autoTable(doc, {
    startY: 28,
    head: [data.headers],
    body: data.rows.map((row) => row.map((v) => String(v ?? ""))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [0, 0, 0] },
  });
  doc.save(`${filename}.pdf`);
}

export default function AdminReportsClient() {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  async function handleExport(report: (typeof reports)[number], format: "csv" | "pdf") {
    setBusyKey(`${report.key}-${format}`);
    setError(null);
    const result = await report.action();
    setBusyKey(null);
    if (isFailure(result)) {
      setError({ key: report.key, message: result.error.message });
      return;
    }
    if (format === "csv") downloadCsv(result.data, report.filename);
    else await downloadPdf(result.data, report.filename);
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <Card key={r.key} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/15">
            <r.icon className="h-5 w-5 text-white/70" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold">{r.title}</p>
            <p className="mt-0.5 text-xs text-white/45">{r.description}</p>
            {error?.key === r.key && <p className="mt-1 text-xs text-red-400">{error.message}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" loading={busyKey === `${r.key}-csv`} onClick={() => handleExport(r, "csv")}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" loading={busyKey === `${r.key}-pdf`} onClick={() => handleExport(r, "pdf")}>
              <FileText className="h-3.5 w-3.5" /> PDF
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
