"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, ChevronRight, Scale } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { AdminClientListItem } from "@/lib/actions/admin-clients.actions";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatSlot(days: number[], startTime: string | null): string {
  if (days.length === 0 || !startTime) return "—";
  const sortedDays = [...days].sort((a, b) => a - b).map((d) => DAYS[d]);
  return `${sortedDays.join("/")} · ${startTime.slice(0, 5)}`;
}

const STATUS_BADGE: Record<AdminClientListItem["status"], { variant: any; label: string }> = {
  active: { variant: "green", label: "Active" },
  paused: { variant: "red", label: "Paused" },
  expired: { variant: "gray", label: "Expired" },
  inactive: { variant: "gray", label: "Inactive" },
};

export default function AdminClientsListClient({ clients }: { clients: AdminClientListItem[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = clients.filter((c) => {
    const q = query.toLowerCase();
    const matchesQuery =
      c.name.toLowerCase().includes(q) || (c.phone ?? "").toLowerCase().includes(q) || c.clientCode.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clients by name, ID, or phone..."
            className="w-full rounded-xl border border-white/10 bg-bg-elevated py-2.5 pl-10 pr-4 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
        </div>
        <div className="flex gap-1 rounded-xl bg-white/5 p-1">
          {["all", "active", "paused", "expired", "inactive"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold capitalize ${
                statusFilter === s ? "bg-bg-elevated shadow-card" : "text-white/50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-12 gap-4 border-b border-white/[0.06] px-5 py-3 text-xs font-bold uppercase text-white/40 sm:grid">
          <div className="col-span-3">Client</div>
          <div className="col-span-2">Package</div>
          <div className="col-span-2">Coach</div>
          <div className="col-span-2">Slot</div>
          <div className="col-span-1">Sessions</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1"></div>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/admin/clients/${c.id}`}
              className="grid grid-cols-2 items-center gap-4 px-5 py-4 hover:bg-white/[0.02] sm:grid-cols-12"
            >
              <div className="col-span-2 flex items-center gap-3 sm:col-span-3">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
                  <Image src={c.photo} alt={c.name} fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{c.name}</p>
                  <p className="truncate text-xs text-white/40">{c.clientCode || c.phone || "—"}</p>
                </div>
              </div>
              <div className="col-span-1 text-sm text-white/60 sm:col-span-2">{c.packageName ?? "—"}</div>
              <div className="col-span-1 text-sm text-white/60 sm:col-span-2">{c.coachName ?? "—"}</div>
              <div className="col-span-1 text-sm text-white/60 sm:col-span-2">{formatSlot(c.slotDays, c.slotStartTime)}</div>
              <div className="col-span-1 text-sm text-white/60">
                {c.sessionsRemaining != null && c.sessionsTotal != null ? `${c.sessionsRemaining} / ${c.sessionsTotal}` : "—"}
              </div>
              <div className="col-span-1 flex flex-wrap items-center gap-1.5">
                <Badge variant={STATUS_BADGE[c.status].variant}>{STATUS_BADGE[c.status].label}</Badge>
                {c.measurementsStale && (
                  <Badge variant="red">
                    <Scale className="h-3 w-3" /> Overdue
                  </Badge>
                )}
              </div>
              <ChevronRight className="col-span-1 hidden h-4 w-4 justify-self-end text-white/30 sm:block" />
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
