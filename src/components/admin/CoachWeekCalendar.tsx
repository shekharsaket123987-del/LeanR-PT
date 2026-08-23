import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { CoachCalendarSlot } from "@/lib/services/scheduling.service";

const STATUS_STYLE: Record<CoachCalendarSlot["status"], string> = {
  open: "bg-emerald-400/15 text-emerald-400 border-emerald-400/20",
  booked: "bg-brand-yellow text-black border-brand-yellow",
  unavailable: "bg-white/[0.04] text-white/25 border-white/[0.04]",
};

const BOOKING_STATUS_LABEL: Record<string, string> = {
  upcoming: "",
  completed: "Completed",
  missed: "Missed",
  cancelled: "",
};

export default function CoachWeekCalendar({ slots }: { slots: CoachCalendarSlot[] }) {
  if (slots.length === 0) {
    return <p className="text-sm text-white/40">No working hours set for this coach.</p>;
  }

  const dates = [...new Set(slots.map((s) => s.date))].sort();
  const times = [...new Set(slots.map((s) => s.time))].sort();
  const byKey = new Map(slots.map((s) => [`${s.date}|${s.time}`, s]));

  const dayLabel = (dateStr: string) =>
    new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-surface-elevated p-2 text-left font-bold text-white/40">Time</th>
            {dates.map((d) => (
              <th key={d} className="p-2 text-center font-bold text-white/60">
                {dayLabel(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((t) => (
            <tr key={t}>
              <td className="sticky left-0 z-10 bg-surface-elevated p-2 font-semibold text-white/50">{t}</td>
              {dates.map((d) => {
                const slot = byKey.get(`${d}|${t}`);
                if (!slot) return <td key={d} className="p-1" />;
                const content = (
                  <div className={`rounded-lg border p-1.5 text-center leading-tight ${STATUS_STYLE[slot.status]}`}>
                    {slot.status === "booked" && slot.booking ? (
                      <>
                        <p className="truncate font-semibold">{slot.booking.clientName}</p>
                        <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] opacity-70">
                          {slot.booking.wasRescheduled && <RotateCcw className="h-2.5 w-2.5" />}
                          {BOOKING_STATUS_LABEL[slot.booking.status]}
                        </div>
                      </>
                    ) : slot.status === "open" ? (
                      "Open"
                    ) : (
                      "—"
                    )}
                  </div>
                );
                return (
                  <td key={d} className="p-1">
                    {slot.status === "booked" && slot.booking ? (
                      <Link href={`/admin/clients/${slot.booking.clientId}`}>{content}</Link>
                    ) : (
                      content
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
