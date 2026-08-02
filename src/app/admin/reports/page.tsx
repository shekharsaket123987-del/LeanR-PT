import { Users, UserCog, CalendarDays, IndianRupee, XCircle, Download } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

const reports = [
  { icon: Users, title: "Client Report", description: "Full client roster with packages, status, and coach assignments.", updated: "Updated daily" },
  { icon: UserCog, title: "Coach Report", description: "Coach performance, utilization, ratings, and client load.", updated: "Updated daily" },
  { icon: CalendarDays, title: "Monthly PT Report", description: "Session volume, completion rate, and assessment conversions.", updated: "Updated monthly" },
  { icon: IndianRupee, title: "Revenue Report", description: "Package sales, add-ons, and revenue breakdown by coach.", updated: "Updated daily" },
  { icon: XCircle, title: "Cancellation / No-Show Report", description: "Cancelled and missed sessions by client and coach.", updated: "Updated daily" },
];

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Reports" description="Export data for finance, ops, and coaching reviews." />

      <div className="space-y-3">
        {reports.map((r) => (
          <Card key={r.title} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/15">
              <r.icon className="h-5 w-5 text-black/70" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">{r.title}</p>
              <p className="mt-0.5 text-xs text-black/45">{r.description}</p>
              <p className="mt-1 text-[11px] text-black/30">{r.updated}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
