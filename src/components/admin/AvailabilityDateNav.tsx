"use client";

import { useRouter } from "next/navigation";

export default function AvailabilityDateNav({ date }: { date: string }) {
  const router = useRouter();

  return (
    <div className="mb-5">
      <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Date</label>
      <input
        type="date"
        value={date}
        onChange={(e) => router.push(`/admin/availability?date=${e.target.value}`)}
        className="w-full max-w-[220px] glass-faint rounded-xl p-2.5 text-sm text-white"
      />
    </div>
  );
}
