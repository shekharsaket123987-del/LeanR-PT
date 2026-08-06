"use client";

import {
  ShoppingBag,
  UserPlus,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  FileText,
  Scale,
  MessageCircleWarning,
  AlertOctagon,
  CheckCheck,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  UserCog2,
  CalendarClock,
  RotateCcw,
  TrendingUp,
  Banknote,
  Clock3,
  ShieldCheck,
  Gift,
} from "lucide-react";
import Card from "@/components/ui/Card";
import { TimelineEventRow, TimelineEventType } from "@/lib/services/timeline.service";
import { formatDate } from "@/lib/utils";

const EVENT_ICONS: Record<TimelineEventType, any> = {
  plan_purchased: ShoppingBag,
  plan_activated: PlayCircle,
  coach_assigned: UserPlus,
  slot_assigned: CalendarPlus,
  session_completed: CheckCircle2,
  attendance_marked_present: ShieldCheck,
  session_missed: XCircle,
  session_cancelled: XCircle,
  coach_notes_uploaded: FileText,
  weekly_measurements_updated: Scale,
  client_raised_concern: MessageCircleWarning,
  escalation_created: AlertOctagon,
  escalation_resolved: CheckCheck,
  pause_started: PauseCircle,
  pause_ended: PlayCircle,
  coach_changed: UserCog2,
  shadow_coach_assigned: UserCog2,
  manual_session_added: CalendarClock,
  session_rescheduled: RotateCcw,
  plan_extended: TrendingUp,
  plan_renewed: RefreshCw,
  refund_requested: Banknote,
  refund_approved: Banknote,
  plan_completed: CheckCheck,
  plan_promise_adjusted: Gift,
};

function groupByDay(events: TimelineEventRow[]): { date: string; events: TimelineEventRow[] }[] {
  const groups: { date: string; events: TimelineEventRow[] }[] = [];
  for (const event of events) {
    const date = formatDate(event.created_at);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.events.push(event);
    } else {
      groups.push({ date, events: [event] });
    }
  }
  return groups;
}

export default function ClientTimeline({ events }: { events: TimelineEventRow[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-black/45">No timeline events yet.</p>;
  }

  const groups = groupByDay(events);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.date}>
          <p className="mb-2 text-xs font-bold uppercase text-black/40">{group.date}</p>
          <div className="space-y-2">
            {group.events.map((event) => {
              const Icon = EVENT_ICONS[event.event_type] ?? Clock3;
              return (
                <Card key={event.id} className="flex items-start gap-3 p-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-yellow/15">
                    <Icon className="h-4 w-4 text-black/70" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{event.title}</p>
                    {event.description && <p className="mt-0.5 text-xs text-black/50">{event.description}</p>}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
