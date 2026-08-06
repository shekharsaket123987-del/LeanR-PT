"use client";

import { useState } from "react";
import { MessageCircleWarning } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { CoachEscalationView } from "@/lib/actions/coach-portal.actions";
import { CONCERN_CATEGORIES } from "@/lib/constants/concern-categories";
import { formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  open: { variant: "red", label: "Open" },
  in_progress: { variant: "outline-yellow", label: "In Progress" },
  resolved: { variant: "green", label: "Resolved" },
};

function categoryLabel(value: string | null) {
  return CONCERN_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

type Tab = "active" | "resolved";

export default function CoachEscalationsClient({ escalations }: { escalations: CoachEscalationView[] }) {
  const [tab, setTab] = useState<Tab>("active");

  const filtered = escalations.filter((e) => (tab === "resolved" ? e.status === "resolved" : e.status !== "resolved"));

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-xl bg-black/5 p-1">
        {(["active", "resolved"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold capitalize transition-colors ${
              tab === t ? "bg-white shadow-card" : "text-black/50 hover:text-black"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <EmptyState
          icon={MessageCircleWarning}
          title={tab === "active" ? "No active escalations" : "Nothing resolved yet"}
          description={tab === "active" ? "Your clients haven't raised any open concerns." : "No resolved escalations on record."}
        />
      )}

      <div className="space-y-3">
        {filtered.map((e) => {
          const badge = STATUS_BADGE[e.status] ?? STATUS_BADGE.open;
          return (
            <Card key={e.id} className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-black/40">{e.clientCode || `#${e.id.slice(0, 8).toUpperCase()}`}</span>
                <Badge variant="gray">{categoryLabel(e.category)}</Badge>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="text-xs text-black/40">{formatDate(e.createdAt)}</span>
              </div>
              <p className="text-sm font-bold">
                {e.clientName}
                {e.packageName && <span className="ml-1.5 font-normal text-black/40">· {e.packageName}</span>}
              </p>
              <p className="mt-1 text-sm text-black/65">{e.reason}</p>
              {e.description && <p className="mt-1 text-xs text-black/50">{e.description}</p>}
              {e.status === "resolved" && e.resolutionNotes && (
                <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                  <span className="font-bold">Resolution: </span>
                  {e.resolutionNotes}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
