"use client";

import { useEffect, useState } from "react";

const JOIN_WINDOW_MS = 10 * 60_000;

export interface JoinCountdownState {
  label: string;
  canJoin: boolean;
  isLive: boolean;
  isPast: boolean;
}

function computeState(scheduledStart: string, durationMinutes: number, now: number): JoinCountdownState {
  const start = new Date(scheduledStart).getTime();
  const end = start + durationMinutes * 60_000;
  const msUntilStart = start - now;

  if (now >= end) return { label: "Session ended", canJoin: false, isLive: false, isPast: true };
  if (msUntilStart <= 0) return { label: "Live now", canJoin: true, isLive: true, isPast: false };

  const canJoin = msUntilStart <= JOIN_WINDOW_MS;
  const totalMinutes = Math.ceil(msUntilStart / 60_000);
  const label =
    totalMinutes < 60 ? `Join in ${totalMinutes} min` : `Join in ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  return { label, canJoin, isLive: false, isPast: false };
}

/** Client-side ticking countdown to a session's start ("join in 59 min"),
 * replacing the old static boolean join-window text
 * (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.3/§3.3). canJoin matches the
 * join-window rule already used elsewhere in the app (enabled from 10
 * minutes before start through the session's end) -- shared here so both
 * portals derive it from one place instead of duplicating the arithmetic. */
export function useJoinCountdown(scheduledStart: string, durationMinutes: number): JoinCountdownState {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return computeState(scheduledStart, durationMinutes, now);
}

export default function JoinCountdown({
  scheduledStart,
  durationMinutes,
  className,
}: {
  scheduledStart: string;
  durationMinutes: number;
  className?: string;
}) {
  const state = useJoinCountdown(scheduledStart, durationMinutes);
  return (
    <span className={className ?? `text-xs font-semibold ${state.isLive ? "text-emerald-400" : "text-white/50"}`}>
      {state.label}
    </span>
  );
}
