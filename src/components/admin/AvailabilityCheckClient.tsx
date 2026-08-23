"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { AvailabilityCheckSlot } from "@/lib/actions/admin-availability.actions";

function formatSlotTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export default function AvailabilityCheckClient({ slots }: { slots: AvailabilityCheckSlot[] }) {
  const [filter, setFilter] = useState<"all" | "booked" | "free">("all");

  const filtered = useMemo(() => (filter === "all" ? slots : slots.filter((s) => s.status === filter)), [slots, filter]);
  const bookedCount = useMemo(() => slots.filter((s) => s.status === "booked").length, [slots]);
  const freeCount = slots.length - bookedCount;

  return (
    <>
      <div className="mb-5 flex gap-1 rounded-xl bg-white/5 p-1 w-fit">
        {([
          ["all", `All (${slots.length})`],
          ["booked", `Booked (${bookedCount})`],
          ["free", `Free (${freeCount})`],
        ] as const).map(([f, label]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold ${filter === f ? "glass-strong" : "text-white/50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-12 gap-4 border-b border-white/[0.06] px-5 py-3 text-xs font-bold uppercase text-white/40 sm:grid">
          <div className="col-span-2">Time</div>
          <div className="col-span-3">Coach</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-5">Details</div>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {filtered.map((s, i) => (
            <div key={`${s.coachId}-${s.time}-${i}`} className="grid grid-cols-2 items-center gap-2 px-5 py-4 sm:grid-cols-12 sm:gap-4">
              <div className="col-span-1 text-sm font-bold sm:col-span-2">{formatSlotTime(s.time)}</div>
              <div className="col-span-1 text-sm text-white/60 sm:col-span-3">{s.coachName}</div>
              <div className="col-span-2 order-3 sm:order-none sm:col-span-2">
                <Badge variant={s.status === "booked" ? "black" : "green"}>{s.status === "booked" ? "Booked" : "Free"}</Badge>
              </div>
              <div className="col-span-2 order-4 text-sm text-white/60 sm:order-none sm:col-span-5">
                {s.status === "booked" && s.booking ? (
                  <Link href={`/admin/clients/${s.booking.clientId}`} className="font-semibold text-white hover:underline">
                    {s.booking.clientName}
                    {s.booking.clientCode ? ` (${s.booking.clientCode})` : ""}
                  </Link>
                ) : (
                  s.freeReason ?? "Free"
                )}
              </div>
            </div>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="p-8">
            <EmptyState icon={Search} title="No slots" description="No slots match this filter for the selected date." />
          </div>
        )}
      </Card>
    </>
  );
}
