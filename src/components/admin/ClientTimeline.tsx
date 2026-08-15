"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingBag,
  UserPlus,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  Pencil,
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
  AlertTriangle,
  ChevronRight,
  X,
} from "lucide-react";
import Card from "@/components/ui/Card";
import { TimelineEventRow, TimelineEventType } from "@/lib/services/timeline.service";

const EVENT_ICONS: Record<TimelineEventType, any> = {
  plan_purchased: ShoppingBag,
  plan_activated: PlayCircle,
  onboarding_completed: ClipboardCheck,
  coach_assigned: UserPlus,
  slot_assigned: CalendarPlus,
  session_completed: CheckCircle2,
  attendance_marked_present: ShieldCheck,
  session_missed: XCircle,
  session_cancelled: XCircle,
  coach_notes_uploaded: Pencil,
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

const EVENT_LABELS: Record<TimelineEventType, string> = {
  plan_purchased: "Subscription purchased",
  plan_activated: "Subscription activated",
  onboarding_completed: "Onboarding completed",
  coach_assigned: "Coach assigned",
  slot_assigned: "Schedule set",
  session_completed: "Session done (present)",
  attendance_marked_present: "Attendance marked",
  session_missed: "Session done (absent)",
  session_cancelled: "Session cancelled",
  coach_notes_uploaded: "Session note updated",
  weekly_measurements_updated: "Measurement logged",
  client_raised_concern: "Concern raised",
  escalation_created: "Support ticket created",
  escalation_resolved: "Support ticket closed",
  pause_started: "Subscription paused",
  pause_ended: "Subscription resumed",
  coach_changed: "Coach changed",
  shadow_coach_assigned: "Shadow coach assigned",
  manual_session_added: "Session added",
  session_rescheduled: "Session rescheduled",
  plan_extended: "Plan extended",
  plan_renewed: "Plan renewed",
  refund_requested: "Refund requested",
  refund_approved: "Refund approved",
  plan_completed: "Plan completed",
  plan_promise_adjusted: "Pause days adjusted",
};

const PAGE_SIZE = 20;

function formatHeaderDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}

function formatHeaderTime(date: string) {
  const d = new Date(date);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${ampm}`;
}

function timestampKey(date: string) {
  // Groups by minute -- same rendered header (date + "HH:MM AM/PM") means no repeat.
  return `${formatHeaderDate(date)} ${formatHeaderTime(date)}`;
}

function addedByLabel(event: TimelineEventRow): string {
  if (event.actor_source === "system") return "SYSTEM";
  if (event.actor_source === "unknown") return "N/A";
  return event.actor_name ?? "N/A";
}

/** Renders a plain-text description safely: converts literal <br> variants
 * (which some upstream callers pass through raw) into real line breaks and
 * strips any other stray markup, without ever using dangerouslySetInnerHTML. */
function MultilineText({ text, className }: { text: string; className?: string }) {
  const lines = useMemo(() => text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[a-z][^>]*>/gi, "").split("\n"), [text]);
  return (
    <p className={className}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </Fragment>
      ))}
    </p>
  );
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

function DetailModal({ event, onClose }: { event: TimelineEventRow; onClose: () => void }) {
  const entries = Object.entries(event.metadata ?? {});
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-black/40">{formatHeaderDate(event.created_at)} · {formatHeaderTime(event.created_at)}</p>
            <h3 className="text-display mt-0.5 text-lg font-bold italic">{event.title}</h3>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
        </div>
        {event.description && <MultilineText text={event.description} className="mb-4 text-sm text-black/65" />}
        {entries.length > 0 && (
          <div className="space-y-2 rounded-xl bg-black/[0.03] p-3.5">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-3 text-xs">
                <span className="font-semibold text-black/45">{humanizeKey(key)}</span>
                <span className="text-right font-medium text-black/75">{String(value)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventCard({ event, onExpand }: { event: TimelineEventRow; onExpand: (event: TimelineEventRow) => void }) {
  const hasDetail = !!event.metadata && Object.keys(event.metadata).length > 0;
  const accent = event.side === "internal" ? "teal" : "orange";
  return (
    <Card className={accent === "teal" ? "border-teal-600/15 p-3.5" : "border-orange-500/20 p-3.5"}>
      <button
        type="button"
        onClick={hasDetail ? () => onExpand(event) : undefined}
        className={`flex w-full items-start justify-between gap-2 text-left ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
        disabled={!hasDetail}
      >
        <p className="text-sm font-bold leading-snug">{event.title}</p>
        {hasDetail && <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-black/30" />}
      </button>
      {event.description && <MultilineText text={event.description} className="mt-1 text-xs leading-relaxed text-black/55" />}
      <div className="my-2.5 border-t border-black/[0.06]" />
      <p className={`text-[11px] font-semibold ${accent === "teal" ? "text-teal-700" : "text-orange-600"}`}>Added by: {addedByLabel(event)}</p>
      {event.updated_at && (
        <p className="mt-1 text-[11px] font-semibold text-emerald-600">
          Updated At: {formatHeaderDate(event.updated_at)}, {formatHeaderTime(event.updated_at)}
        </p>
      )}
    </Card>
  );
}

function IconBadge({ type, side }: { type: TimelineEventType; side: "internal" | "customer" }) {
  const Icon = EVENT_ICONS[type] ?? Clock3;
  return (
    <div
      className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${
        side === "internal" ? "bg-teal-600" : "bg-orange-500"
      }`}
    >
      <Icon className="h-4 w-4 text-white" />
    </div>
  );
}

interface TimestampGroup {
  key: string;
  date: string;
  time: string;
  events: TimelineEventRow[];
}

function groupByTimestamp(events: TimelineEventRow[]): TimestampGroup[] {
  const groups: TimestampGroup[] = [];
  for (const event of events) {
    const key = timestampKey(event.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.events.push(event);
    } else {
      groups.push({ key, date: formatHeaderDate(event.created_at), time: formatHeaderTime(event.created_at), events: [event] });
    }
  }
  return groups;
}

/** measurementsStale/lastMeasurementAt are live-computed (not persisted
 * timeline rows) -- rendered as a standalone banner above the timeline
 * rather than injected as a fake event, since re-checking staleness on
 * every render would otherwise mean a new row appearing and disappearing
 * depending on when this is viewed. */
export default function ClientTimeline({
  events,
  measurementsStale,
  lastMeasurementAt,
}: {
  events: TimelineEventRow[];
  measurementsStale?: boolean;
  lastMeasurementAt?: string | null;
}) {
  const [mode, setMode] = useState<"split" | "merged">("split");
  const [filterType, setFilterType] = useState<TimelineEventType | "all">("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<TimelineEventRow | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const availableTypes = useMemo(() => {
    const seen = new Set<TimelineEventType>();
    events.forEach((e) => seen.add(e.event_type));
    return Array.from(seen);
  }, [events]);

  // events already arrive newest-first from listClientTimeline().
  const filtered = useMemo(
    () => (filterType === "all" ? events : events.filter((e) => e.event_type === filterType)),
    [events, filterType]
  );

  useEffect(() => setVisibleCount(PAGE_SIZE), [filterType]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const groups = useMemo(() => groupByTimestamp(visible), [visible]);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((c) => c + PAGE_SIZE);
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore]);

  return (
    <div className="space-y-5">
      {measurementsStale && (
        <Card className="flex items-center gap-3 border-red-500/30 bg-red-500/5 p-3.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
          <p className="text-sm font-semibold text-red-700">
            Measurements overdue{lastMeasurementAt ? ` — last updated ${formatHeaderDate(lastMeasurementAt)}` : " — never logged"}.
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-black/10 p-1">
          <button
            type="button"
            onClick={() => setMode("split")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${mode === "split" ? "bg-black text-white" : "text-black/50 hover:text-black"}`}
          >
            Split view
          </button>
          <button
            type="button"
            onClick={() => setMode("merged")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${mode === "merged" ? "bg-black text-white" : "text-black/50 hover:text-black"}`}
          >
            Merged view
          </button>
        </div>

        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as TimelineEventType | "all")}
          className="rounded-xl border border-black/15 bg-white px-3 py-1.5 text-xs font-semibold text-black/70"
        >
          <option value="all">Filter by event type/source: All</option>
          {availableTypes.map((t) => (
            <option key={t} value={t}>
              {EVENT_LABELS[t] ?? t}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 && <p className="text-sm text-black/45">No timeline events yet.</p>}

      {mode === "split" ? (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-black/10" />
          <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-bold uppercase text-black/35">
            <span>LEANR Event</span>
            <span>Customer Event</span>
          </div>
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-black/50">{group.date}</span>
                  <span className="text-xs font-bold text-black/50">{group.time}</span>
                </div>
                <div className="space-y-3">
                  {group.events.map((event) => (
                    <div key={event.id} className="grid grid-cols-[1fr_2.5rem_1fr] items-start gap-x-3">
                      <div>{event.side === "internal" && <EventCard event={event} onExpand={setExpanded} />}</div>
                      <div className="flex justify-center pt-0.5">
                        <IconBadge type={event.event_type} side={event.side} />
                      </div>
                      <div>{event.side === "customer" && <EventCard event={event} onExpand={setExpanded} />}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-bold text-black/50">{group.date}</span>
                <span className="text-xs font-bold text-black/50">{group.time}</span>
              </div>
              <div className="space-y-3">
                {group.events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <IconBadge type={event.event_type} side={event.side} />
                    <div className="min-w-0 flex-1">
                      <EventCard event={event} onExpand={setExpanded} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-2">
          <button
            type="button"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="text-xs font-bold text-black/40 hover:text-black/70"
          >
            Load more…
          </button>
        </div>
      )}

      {expanded && <DetailModal event={expanded} onClose={() => setExpanded(null)} />}
    </div>
  );
}
