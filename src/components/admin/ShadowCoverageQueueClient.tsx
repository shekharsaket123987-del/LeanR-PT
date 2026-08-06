"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { ShadowCoverageGap } from "@/lib/services/scheduling.service";
import { formatDate, formatTime } from "@/lib/utils";

export default function ShadowCoverageQueueClient({ gaps }: { gaps: ShadowCoverageGap[] }) {
  if (gaps.length === 0) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="All covered"
        description="No client sessions are currently sitting with a coach who's on approved leave."
      />
    );
  }

  return (
    <div className="space-y-3">
      {gaps.map((g) => (
        <Card key={g.bookingId} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold">
              {g.clientName}
              {g.clientCode && <span className="ml-1.5 font-normal text-black/40">({g.clientCode})</span>}
            </p>
            <p className="mt-0.5 text-xs text-black/50">
              Session {formatDate(g.scheduledStart)} · {formatTime(g.scheduledStart)} with {g.coachName}
            </p>
            <p className="mt-1 text-xs text-red-600">
              {g.coachName} is on approved leave {formatDate(g.leaveStartsOn)}
              {g.leaveEndsOn !== g.leaveStartsOn ? `–${formatDate(g.leaveEndsOn)}` : ""}
              {g.leaveReason ? ` — "${g.leaveReason}"` : ""} and no shadow coach has been assigned for this session yet.
            </p>
          </div>
          <Link href={`/admin/clients/${g.clientId}`}>
            <Button size="sm" variant="outline">
              Assign shadow coach <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </Card>
      ))}
    </div>
  );
}
