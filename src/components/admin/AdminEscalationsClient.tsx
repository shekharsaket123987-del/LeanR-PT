"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock3, MessageCircleWarning } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { AdminGlobalEscalationView, markEscalationInProgressAction, resolveEscalationAction } from "@/lib/actions/admin-escalations.actions";
import { isFailure } from "@/lib/actions/action-result";
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

export default function AdminEscalationsClient({ escalations }: { escalations: AdminGlobalEscalationView[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = escalations.filter((e) => (tab === "resolved" ? e.status === "resolved" : e.status !== "resolved"));

  async function markInProgress(id: string) {
    setBusyId(id);
    setError("");
    const result = await markEscalationInProgressAction(id);
    setBusyId(null);
    if (isFailure(result)) return setError(result.error.message);
    router.refresh();
  }

  async function resolve(id: string) {
    setBusyId(id);
    setError("");
    const result = await resolveEscalationAction(id);
    setBusyId(null);
    if (isFailure(result)) return setError(result.error.message);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex gap-1 rounded-xl bg-white/5 p-1">
        {(["active", "resolved"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-bold capitalize transition-colors ${
              tab === t ? "glass-strong" : "text-white/50 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      {filtered.length === 0 && (
        <EmptyState
          icon={MessageCircleWarning}
          title={tab === "active" ? "No active escalations" : "Nothing resolved yet"}
          description={tab === "active" ? "No clients have open concerns right now." : "No resolved escalations on record."}
        />
      )}

      <div className="space-y-3">
        {filtered.map((e) => {
          const badge = STATUS_BADGE[e.status] ?? STATUS_BADGE.open;
          return (
            <Card key={e.id} className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-white/40">{e.clientCode || `#${e.id.slice(0, 8).toUpperCase()}`}</span>
                <Badge variant="gray">{categoryLabel(e.category)}</Badge>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="text-xs text-white/40">{formatDate(e.createdAt)}</span>
              </div>
              <Link href={`/admin/clients/${e.clientId}`} className="text-sm font-bold hover:underline">
                {e.clientName}
              </Link>
              {e.packageName && <span className="ml-1.5 text-xs font-normal text-white/40">· {e.packageName}</span>}
              <p className="mt-1 text-sm text-white/65">{e.reason}</p>
              {e.description && <p className="mt-1 text-xs text-white/50">{e.description}</p>}
              {e.status === "resolved" && e.resolutionNotes && (
                <p className="mt-2 rounded-lg bg-emerald-400/10 p-3 text-xs text-emerald-300">
                  <span className="font-bold">Resolution: </span>
                  {e.resolutionNotes}
                </p>
              )}
              {e.status !== "resolved" && (
                <div className="mt-3 flex gap-2">
                  {e.status === "open" && (
                    <Button size="sm" variant="outline" loading={busyId === e.id} onClick={() => markInProgress(e.id)}>
                      <Clock3 className="h-3.5 w-3.5" /> Mark In Progress
                    </Button>
                  )}
                  <Button size="sm" loading={busyId === e.id} onClick={() => resolve(e.id)}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark Resolved
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
