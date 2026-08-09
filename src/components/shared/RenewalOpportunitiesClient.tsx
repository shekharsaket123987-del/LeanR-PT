"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { RefreshCcw } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { RenewalOpportunityRow } from "@/lib/services/renewals.service";

type Tab = "opportunity" | "expired";
const TABS: { key: Tab; label: string }[] = [
  { key: "opportunity", label: "Renewal Opportunities" },
  { key: "expired", label: "Expired" },
];

/** Shared by both /coach/renewals and /admin/renewals -- the underlying
 * data (listRenewalOpportunities) already scopes itself correctly per
 * caller via RLS, so the only difference between the two portals is the
 * link prefix and whether the Coach column makes sense to show at all
 * (every row is already "my client" on the coach side). */
export default function RenewalOpportunitiesClient({ rows, role }: { rows: RenewalOpportunityRow[]; role: "coach" | "admin" }) {
  const [tab, setTab] = useState<Tab>("opportunity");
  const filtered = rows.filter((r) => r.category === tab);

  return (
    <>
      <div className="mb-5 flex gap-1 rounded-xl bg-black/5 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              tab === t.key ? "bg-white shadow-card" : "text-black/50 hover:text-black"
            }`}
          >
            {t.label} ({rows.filter((r) => r.category === t.key).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={RefreshCcw}
          title={tab === "opportunity" ? "No renewal opportunities right now" : "No expired clients"}
          description={tab === "opportunity" ? "Nobody is currently running low on sessions." : "Nobody has fully lapsed without renewing."}
        />
      ) : (
        <Card className="overflow-hidden">
          <div
            className={`hidden grid-cols-12 gap-4 border-b border-black/[0.06] px-5 py-3 text-xs font-bold uppercase text-black/40 sm:grid`}
          >
            <div className="col-span-3">Client</div>
            <div className="col-span-2">Plan</div>
            {role === "admin" && <div className="col-span-2">Coach</div>}
            <div className={role === "admin" ? "col-span-2" : "col-span-3"}>Sessions Left</div>
            <div className={role === "admin" ? "col-span-3" : "col-span-4"}>Renewed?</div>
          </div>
          <div className="divide-y divide-black/[0.05]">
            {filtered.map((r) => (
              <Link
                key={r.clientId}
                href={`/${role}/clients/${r.clientId}`}
                className="grid grid-cols-2 items-center gap-4 px-5 py-4 hover:bg-black/[0.02] sm:grid-cols-12"
              >
                <div className="col-span-2 flex items-center gap-3 sm:col-span-3">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
                    <Image src={r.clientPhoto} alt={r.clientName} fill className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{r.clientName}</p>
                    <p className="truncate text-xs text-black/40">{r.clientCode || "—"}</p>
                  </div>
                </div>
                <div className="col-span-1 text-sm text-black/60 sm:col-span-2">{r.packageName ?? "—"}</div>
                {role === "admin" && <div className="col-span-1 text-sm text-black/60 sm:col-span-2">{r.coachName ?? "—"}</div>}
                <div className={`col-span-1 text-sm font-bold text-black/70 ${role === "admin" ? "sm:col-span-2" : "sm:col-span-3"}`}>
                  {r.sessionsRemaining}
                </div>
                <div className={`col-span-1 ${role === "admin" ? "sm:col-span-3" : "sm:col-span-4"}`}>
                  <Badge variant={r.converted ? "green" : "gray"}>{r.converted ? "Converted" : "Not Converted"}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
