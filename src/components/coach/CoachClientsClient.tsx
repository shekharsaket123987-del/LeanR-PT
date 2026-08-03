"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, ChevronRight, Users2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { CoachClientView } from "@/lib/actions/coach-portal.actions";
import { formatDate } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_BADGE: Record<CoachClientView["status"], { variant: any; label: string }> = {
  active: { variant: "green", label: "Active" },
  paused: { variant: "red", label: "Paused" },
  completed: { variant: "gray", label: "Completed" },
  waiting_to_start: { variant: "outline-yellow", label: "Waiting to Start" },
};

function formatSlot(days: number[], startTime: string | null): string {
  if (days.length === 0 || !startTime) return "—";
  const sortedDays = [...days].sort((a, b) => a - b).map((d) => DAYS[d]);
  return `${sortedDays.join("/")} · ${startTime.slice(0, 5)}`;
}

export default function CoachClientsClient({ clients }: { clients: CoachClientView[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [dayFilter, setDayFilter] = useState<string>("all");

  const plans = useMemo(() => Array.from(new Set(clients.map((c) => c.packageName).filter(Boolean))) as string[], [clients]);

  const filtered = clients.filter((c) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.clientCode.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    const matchesPlan = planFilter === "all" || c.packageName === planFilter;
    const matchesDay = dayFilter === "all" || c.days.includes(Number(dayFilter));
    return matchesQuery && matchesStatus && matchesPlan && matchesDay;
  });

  return (
    <>
      <div className="mb-5 flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Client ID or name..."
            className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-xl bg-black/5 p-1">
            {(["all", "active", "waiting_to_start", "paused", "completed"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold ${
                  statusFilter === s ? "bg-white shadow-card" : "text-black/50"
                }`}
              >
                {s === "all" ? "All" : STATUS_BADGE[s].label}
              </button>
            ))}
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="all">All Plans</option>
            {plans.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold"
          >
            <option value="all">All Days</option>
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 && <EmptyState icon={Users2} title="No clients match" description="Try a different search or filter." />}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-12 gap-4 border-b border-black/[0.06] px-5 py-3 text-xs font-bold uppercase text-black/40 sm:grid">
          <div className="col-span-4">Client</div>
          <div className="col-span-2">Plan</div>
          <div className="col-span-1">Start Date</div>
          <div className="col-span-2">Slot</div>
          <div className="col-span-1">Progress</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1"></div>
        </div>
        <div className="divide-y divide-black/[0.05]">
          {filtered.map((c) => {
            const badge = STATUS_BADGE[c.status];
            return (
              <Link
                key={c.id}
                href={`/coach/clients/${c.id}`}
                className="grid grid-cols-2 items-center gap-4 px-5 py-4 hover:bg-black/[0.02] sm:grid-cols-12"
              >
                <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
                    <Image src={c.photo} alt={c.name} fill className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{c.name}</p>
                    <p className="truncate font-mono text-[11px] text-black/40">{c.clientCode}</p>
                  </div>
                </div>
                <div className="col-span-1 truncate text-sm text-black/60 sm:col-span-2">{c.packageName ?? "—"}</div>
                <div className="col-span-1 text-sm text-black/60">{formatDate(c.joinedDate)}</div>
                <div className="col-span-1 truncate text-sm text-black/60 sm:col-span-2">{formatSlot(c.days, c.startTime)}</div>
                <div className="col-span-1 text-sm text-black/60">
                  {c.sessionsCompleted} / {c.sessionsPurchased || "—"}
                </div>
                <div className="col-span-1">
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
                <ChevronRight className="col-span-1 hidden h-4 w-4 justify-self-end text-black/30 sm:block" />
              </Link>
            );
          })}
        </div>
      </Card>
    </>
  );
}
