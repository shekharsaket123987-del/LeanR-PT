import { getMyClientProfile, getMyCurrentCoachId } from "./clients.service";
import { getMyOnboarding } from "./onboarding.service";
import { getMyLatestSubscription } from "./planPurchase.service";
import { listMyBookingsAsClient } from "./bookings.service";
import { listProgressLogsForClient } from "./progressLogs.service";
import { isMeasurementStale } from "./progressLogs.service";
import { listEscalationsForClient, listEscalationNotesForClient } from "./escalations.service";
import { listClientTimeline, getTimelineEventTiers } from "./timeline.service";
import { listMyActiveMemoryNotes } from "./aiMemoryNotes.service";
import { getClientStatusSnapshot } from "./clientStatus";
import { CLIENT_STATUS_LABELS } from "@/lib/client-status";
import { CONCERN_CATEGORIES } from "@/lib/constants/concern-categories";

/** Tier lookup now comes from the admin-editable timeline_event_tiers table
 * (migration 0059) instead of a hardcoded set -- a new event_type with no
 * row there defaults to 'C' (never sent to the AI), same default-deny
 * behaviour as before. This is still the main mechanical enforcement of
 * "the AI doesn't get to see everything," alongside simply never querying
 * escalations.fault/admin_summary/admin_issue_type/called_client_at/
 * called_by/resolved_by or workout_notes (coach's private session
 * assessment -- not client-facing anywhere else in the app today, and this
 * must not become the first place it leaks) anywhere in this file. */

function categoryLabel(value: string | null) {
  return CONCERN_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/** Builds the client's own AI Buddy prompt context, resolving everything
 * from their own access token (never accepts a client_id from a caller) --
 * every underlying service call is a "my own record" read (getMyClientProfile,
 * getMyOnboarding, listMyBookingsAsClient, etc.), same trust boundary as the
 * rest of the client portal. Returns plain text, not a JSON dump, to keep the
 * prompt compact and to make excluded fields structurally absent rather than
 * merely instructed-away. */
export async function buildAIBuddyContext(accessToken: string): Promise<{ clientId: string; contextText: string }> {
  const client: any = await getMyClientProfile(accessToken);
  const clientId = client.id;

  const [status, onboarding, subscription, bookings, progressLogs, escalations, escalationNotes, timeline, coachId, tiers, memoryNotes] =
    await Promise.all([
      getClientStatusSnapshot(clientId),
      getMyOnboarding(accessToken),
      getMyLatestSubscription(accessToken),
      listMyBookingsAsClient(accessToken),
      listProgressLogsForClient(accessToken, clientId),
      listEscalationsForClient(accessToken, clientId),
      listEscalationNotesForClient(accessToken, clientId),
      listClientTimeline(accessToken, clientId),
      getMyCurrentCoachId(accessToken),
      getTimelineEventTiers(),
      listMyActiveMemoryNotes(accessToken),
    ]);

  const lines: string[] = [];

  lines.push(`Client name: ${client.profile?.full_name ?? "Unknown"}`);
  lines.push(`Status: ${CLIENT_STATUS_LABELS[status]}`);
  if (subscription?.package?.name) lines.push(`Package: ${subscription.package.name} (subscription status: ${subscription.status})`);
  if (coachId) lines.push(`Has an assigned coach.`);
  if (client.goals?.length) lines.push(`Goals: ${client.goals.join(", ")}`);
  if (onboarding?.fitness_goal) lines.push(`Fitness goal (from onboarding): ${onboarding.fitness_goal}`);
  if (client.medical_notes) lines.push(`Medical notes (client-reported): ${client.medical_notes}`);

  // Progress -- latest two logs only, enough for a trend line.
  const recentLogs = (progressLogs as any[]).slice(0, 2);
  if (recentLogs.length > 0) {
    const latest = recentLogs[0];
    const ago = daysAgo(latest.logged_at);
    lines.push(
      `Latest measurement (${ago ?? "?"} days ago${isMeasurementStale(latest.logged_at) ? ", STALE -- overdue for an update" : ""}): weight ${latest.weight ?? "—"}kg, body fat ${latest.body_fat_pct ?? "—"}%.`
    );
    if (recentLogs[1]) {
      const prev = recentLogs[1];
      lines.push(`Previous measurement: weight ${prev.weight ?? "—"}kg, body fat ${prev.body_fat_pct ?? "—"}%.`);
    }
  } else {
    lines.push("No measurements logged yet.");
  }

  // Sessions -- next 3 upcoming, last 3 completed/missed.
  const upcoming = (bookings as any[]).filter((b) => b.status === "upcoming").slice(-3);
  const past = (bookings as any[]).filter((b) => b.status === "completed" || b.status === "missed").slice(0, 3);
  if (upcoming.length > 0) {
    lines.push("Upcoming sessions:");
    for (const b of upcoming) lines.push(`  - ${b.scheduled_start} with ${b.coach?.profile?.full_name ?? "coach"} (${b.status})`);
  }
  if (past.length > 0) {
    lines.push("Recent sessions:");
    for (const b of past) lines.push(`  - ${b.scheduled_start} with ${b.coach?.profile?.full_name ?? "coach"}: ${b.status}`);
  }

  // Concerns -- same client-visible shape MyConcernsClient renders, nothing
  // admin-internal (fault/admin_summary/admin_issue_type/called_client_at)
  // is queried here at all.
  const notesByEscalation = new Map<string, string[]>();
  for (const n of escalationNotes as any[]) {
    const list = notesByEscalation.get(n.escalation_id) ?? [];
    list.push(n.note);
    notesByEscalation.set(n.escalation_id, list);
  }
  const openConcerns = (escalations as any[]).filter((e) => e.status !== "resolved");
  if (openConcerns.length > 0) {
    lines.push("Open concerns already raised (do not propose raising a duplicate for the same issue):");
    for (const e of openConcerns) {
      lines.push(`  - [${categoryLabel(e.category)}] ${e.reason} -- status: ${e.status}`);
      for (const note of notesByEscalation.get(e.id) ?? []) lines.push(`    update: ${note}`);
    }
  }

  // Timeline -- Tier A only, quotable outright.
  const tierAEvents = (timeline as any[]).filter((t) => tiers[t.event_type] === "A").slice(0, 15);
  if (tierAEvents.length > 0) {
    lines.push("Recent activity:");
    for (const t of tierAEvents) lines.push(`  - ${t.created_at}: ${t.title}`);
  }

  // Tier B -- background only. Titles/descriptions here are deliberately
  // never client-facing anywhere else (e.g. coach_notes_uploaded's title is
  // just "Session Note Updated", no note content) -- if that ever changes,
  // whoever adds richer text to a Tier B event_type must keep it safe to
  // hand to the model unquoted, since this is exactly what "shapes tone,
  // never quoted" means in practice.
  const tierBEvents = (timeline as any[]).filter((t) => tiers[t.event_type] === "B").slice(0, 10);
  if (tierBEvents.length > 0) {
    lines.push("Background context (do not quote or mention this directly -- use only to judge tone):");
    for (const t of tierBEvents) lines.push(`  - ${t.created_at}: ${t.title}`);
  }

  // Memory notes -- things the client said themselves, capped at 3 by
  // relevance-via-recency (PRD §10.1 "at most 3 memory notes per reply").
  const recentNotes = (memoryNotes as any[]).slice(0, 3);
  if (recentNotes.length > 0) {
    lines.push("Things the client has told you before (still relevant):");
    for (const n of recentNotes) lines.push(`  - ${n.content}`);
  }

  return { clientId, contextText: lines.join("\n") };
}
