import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { getAuditLogAction } from "@/lib/actions/admin-audit.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

const ENTITY_FILTERS = [
  { value: "", label: "All" },
  { value: "bookings", label: "Bookings" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "coach_change_requests", label: "Coach Changes" },
  { value: "client_profiles", label: "Client Profiles" },
  { value: "coach_profiles", label: "Coach Profiles" },
  { value: "package_tiers", label: "Packages" },
  { value: "system_settings", label: "Settings" },
];

const ACTION_BADGE: Record<string, "green" | "outline-yellow" | "red"> = {
  INSERT: "green",
  UPDATE: "outline-yellow",
  DELETE: "red",
};

export default async function AdminActivityLogPage({ searchParams }: { searchParams: { entityType?: string } }) {
  const entityType = searchParams.entityType ?? "";
  const result = await getAuditLogAction(entityType || undefined);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Activity Log" description="Every create/update/delete across bookings, subscriptions, and profiles — permanent, system-generated." />

      <div className="mb-5 flex flex-wrap gap-1 rounded-xl bg-white/5 p-1">
        {ENTITY_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/activity-log?entityType=${f.value}` : "/admin/activity-log"}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold ${
              entityType === f.value ? "bg-bg-elevated shadow-card" : "text-white/50"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load the activity log" description={result.error.message} />
      ) : result.data.length === 0 ? (
        <p className="text-sm text-white/45">No activity recorded yet.</p>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-white/[0.05]">
            {result.data.map((entry) => (
              <div key={entry.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={ACTION_BADGE[entry.action] ?? "gray"}>{entry.action}</Badge>
                  <span className="text-xs font-bold text-white/60">{entry.entityType}</span>
                  <span className="text-xs text-white/40">by {entry.actorName}</span>
                  <span className="ml-auto text-[11px] text-white/35">
                    {formatDate(entry.createdAt)} · {formatTime(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-white/60">{entry.summary}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
