import Image from "next/image";
import Link from "next/link";
import { CalendarDays, ShieldCheck } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { CoachUpcomingView } from "@/lib/actions/coach-portal.actions";
import { formatDate, formatTime } from "@/lib/utils";

export default function CoachUpcomingClient({ sessions }: { sessions: CoachUpcomingView[] }) {
  if (sessions.length === 0) {
    return <EmptyState icon={CalendarDays} title="Nothing in the next 3 days" description="Your upcoming schedule is clear for now." />;
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <Card key={s.bookingId} className="flex items-center gap-3 p-4">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl">
            <Image src={s.clientPhoto} alt={s.clientName} fill className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <Link href={`/coach/clients/${s.clientId}`} className="text-sm font-bold hover:underline">
              {s.clientName}
            </Link>
            {s.isShadowSession && (
              <Badge variant="outline-yellow" className="ml-1.5">
                <ShieldCheck className="h-3 w-3" /> Shadow
              </Badge>
            )}
            <p className="truncate text-xs text-black/45">
              {s.clientCode && `${s.clientCode} · `}
              {s.packageName ?? "No active plan"}
            </p>
          </div>
          <p className="shrink-0 text-right text-xs font-semibold text-black/60">
            {formatDate(s.scheduledStart)}
            <br />
            {formatTime(s.scheduledStart)}
          </p>
        </Card>
      ))}
    </div>
  );
}
