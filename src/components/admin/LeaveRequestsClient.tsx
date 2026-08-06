"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, Clock3, ArrowRight } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { AdminLeaveRequestView, resolveLeaveAction } from "@/lib/actions/admin-leave.actions";
import { LeaveResolutionSummary } from "@/lib/services/availability.service";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

export default function LeaveRequestsClient({ requests }: { requests: AdminLeaveRequestView[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [justApproved, setJustApproved] = useState<{ request: AdminLeaveRequestView; summary: LeaveResolutionSummary } | null>(null);

  async function resolve(request: AdminLeaveRequestView, status: "approved" | "rejected") {
    setBusyId(request.id);
    setError("");
    const result = await resolveLeaveAction(request.id, status);
    setBusyId(null);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setJustApproved(status === "approved" ? { request, summary: result.data } : null);
    router.refresh();
  }

  if (requests.length === 0 && !justApproved) {
    return <EmptyState icon={CheckCircle2} title="All caught up" description="No pending leave requests right now." />;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {justApproved && (
        <Card className="space-y-3 border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-900">
            Leave approved for {justApproved.request.coachName} ({formatDate(justApproved.request.startsOn)}–{formatDate(justApproved.request.endsOn)})
          </p>
          {justApproved.summary.assigned.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-emerald-700">Shadow coverage auto-assigned</p>
              <ul className="mt-1 space-y-0.5 text-xs text-emerald-800">
                {justApproved.summary.assigned.map((a) => (
                  <li key={a.clientId}>
                    {a.clientName} →{" "}
                    {a.shadowCoaches
                      .map(
                        (sc) =>
                          `${sc.shadowCoachName} (${formatDate(sc.startsOn)}${sc.endsOn !== sc.startsOn ? `–${formatDate(sc.endsOn)}` : ""})`
                      )
                      .join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {justApproved.summary.unassignedFlagged.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-red-700">Needs manual assignment -- no shadow coach available</p>
              <ul className="mt-1 space-y-0.5 text-xs text-red-700">
                {justApproved.summary.unassignedFlagged.map((c) => (
                  <li key={c.clientId}>
                    {c.clientName} ({c.uncoveredDates.map((d) => formatDate(d)).join(", ")})
                  </li>
                ))}
              </ul>
              <Link href={`/admin/coaches/${justApproved.request.coachId}`}>
                <Button size="sm" variant="outline" className="mt-2">
                  Review clients <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          )}
          {justApproved.summary.assigned.length === 0 && justApproved.summary.unassignedFlagged.length === 0 && (
            <p className="text-xs text-emerald-700">This coach has no active clients affected during the leave window.</p>
          )}
        </Card>
      )}

      {requests
        .filter((r) => r.id !== justApproved?.request.id)
        .map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/15">
                  <Clock3 className="h-5 w-5 text-black/70" />
                </div>
                <div>
                  <p className="text-sm font-bold">{r.coachName}</p>
                  <p className="text-xs text-black/45">
                    {r.leaveType === "partial"
                      ? `${formatDate(r.startsOn)} · ${r.partialStartTime?.slice(0, 5)}–${r.partialEndTime?.slice(0, 5)}`
                      : `${formatDate(r.startsOn)} – ${formatDate(r.endsOn)}`}
                  </p>
                </div>
              </div>
              {r.reason && <p className="flex-1 rounded-lg bg-black/[0.03] p-3 text-xs text-black/60">&ldquo;{r.reason}&rdquo;</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" loading={busyId === r.id} onClick={() => resolve(r, "rejected")}>
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </Button>
                <Button size="sm" loading={busyId === r.id} onClick={() => resolve(r, "approved")}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </Button>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-black/35">Submitted {formatDate(r.submittedAt)}</p>
          </Card>
        ))}
    </div>
  );
}
