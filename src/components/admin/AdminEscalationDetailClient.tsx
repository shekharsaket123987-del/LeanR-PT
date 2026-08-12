"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PhoneCall, CheckCircle2, Clock3, Save, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import {
  AdminEscalationDetailView,
  confirmCalledClientAction,
  updateEscalationDetailsAction,
  addEscalationNoteAction,
  markEscalationInProgressAction,
  resolveEscalationAction,
} from "@/lib/actions/admin-escalations.actions";
import { isFailure } from "@/lib/actions/action-result";
import { CONCERN_CATEGORIES, ADMIN_ISSUE_TYPES, FAULT_OPTIONS } from "@/lib/constants/concern-categories";
import { formatDate, formatTime } from "@/lib/utils";

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  open: { variant: "red", label: "Open" },
  in_progress: { variant: "outline-yellow", label: "In Progress" },
  resolved: { variant: "green", label: "Resolved" },
};

function categoryLabel(value: string | null) {
  return CONCERN_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

export default function AdminEscalationDetailClient({ escalation }: { escalation: AdminEscalationDetailView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [issueType, setIssueType] = useState(escalation.issueType ?? "");
  const [fault, setFault] = useState(escalation.fault ?? "");
  const [adminSummary, setAdminSummary] = useState(escalation.adminSummary ?? "");
  const [resolutionNotes, setResolutionNotes] = useState(escalation.resolutionNotes ?? "");
  const [newNote, setNewNote] = useState("");

  const called = !!escalation.calledClientAt;
  const badge = STATUS_BADGE[escalation.status] ?? STATUS_BADGE.open;

  async function run(action: () => Promise<any>) {
    setBusy(true);
    setError("");
    const result = await action();
    setBusy(false);
    if (result && isFailure(result)) {
      setError(result.error.message);
      return false;
    }
    router.refresh();
    return true;
  }

  return (
    <div className="space-y-5">
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</p>}

      {/* Client's own report -- read-only, exactly what they submitted */}
      <Card className="p-6">
        <p className="mb-3 text-xs font-bold uppercase tracking-wide text-black/40">Client&apos;s Report</p>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-bold text-black/40">{escalation.clientCode || `#${escalation.id.slice(0, 8).toUpperCase()}`}</span>
          <Badge variant="gray">{categoryLabel(escalation.category)}</Badge>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </div>
        <p className="text-sm font-bold">{escalation.clientName}</p>
        {escalation.coachName && <p className="text-xs text-black/45">Coach: {escalation.coachName}</p>}
        <p className="mt-2 text-sm text-black/70">{escalation.reason}</p>
        {escalation.description && <p className="mt-1 text-sm text-black/55">{escalation.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-black/40">
          <span>Raised: {formatDate(escalation.createdAt)} · {formatTime(escalation.createdAt)}</span>
          {escalation.resolvedAt && <span>Resolved: {formatDate(escalation.resolvedAt)} · {formatTime(escalation.resolvedAt)}</span>}
        </div>
      </Card>

      {/* Gate: nothing else is actionable until the admin confirms the call */}
      {!called ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <PhoneCall className="mt-0.5 h-5 w-5 shrink-0 text-black/50" />
            <div>
              <p className="text-sm font-bold">Call the client first</p>
              <p className="mt-1 text-xs text-black/50">
                Discuss the issue with the client over the phone before working the case. Once confirmed, issue classification,
                fault, and status changes unlock below.
              </p>
            </div>
          </div>
          <Button className="mt-4" loading={busy} onClick={() => run(() => confirmCalledClientAction(escalation.id))}>
            <PhoneCall className="h-4 w-4" /> Confirm I&apos;ve Called the Client
          </Button>
        </Card>
      ) : (
        <>
          <p className="text-xs text-black/40">
            Called the client on {formatDate(escalation.calledClientAt!)} · {formatTime(escalation.calledClientAt!)}
          </p>

          <Card className="p-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-black/40">Admin Assessment</p>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Issue Type</label>
                <select value={issueType} onChange={(e) => setIssueType(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm">
                  <option value="">Select...</option>
                  {ADMIN_ISSUE_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Who&apos;s at Fault</label>
                <select value={fault} onChange={(e) => setFault(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm">
                  <option value="">Select...</option>
                  {FAULT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Case Summary (internal)</label>
                <textarea
                  value={adminSummary}
                  onChange={(e) => setAdminSummary(e.target.value)}
                  rows={3}
                  placeholder="What's actually going on, in your own words"
                  className="w-full rounded-xl border border-black/15 p-3 text-sm"
                />
              </div>
              <Button
                variant="outline"
                loading={busy}
                onClick={() => run(() => updateEscalationDetailsAction(escalation.id, { issueType, fault, adminSummary }))}
              >
                <Save className="h-4 w-4" /> Save Assessment
              </Button>
            </div>
          </Card>

          {/* Progress notes -- client-visible trail for multi-day cases */}
          <Card className="p-6">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-black/40">Progress Notes</p>
            <p className="mb-3 text-xs text-black/45">Visible to the client -- use this to log updates while coordinating across teams.</p>
            <div className="mb-4 space-y-3">
              {escalation.notes.length === 0 && <p className="text-sm text-black/40">No notes yet.</p>}
              {escalation.notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-black/[0.03] p-3">
                  <p className="text-sm text-black/70">{n.note}</p>
                  <p className="mt-1 text-[11px] text-black/40">
                    {n.authorName} · {formatDate(n.createdAt)} · {formatTime(n.createdAt)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                placeholder="Add a progress update..."
                className="flex-1 rounded-xl border border-black/15 p-3 text-sm"
              />
              <Button
                loading={busy}
                disabled={!newNote.trim()}
                onClick={async () => {
                  const ok = await run(() => addEscalationNoteAction(escalation.id, newNote.trim()));
                  if (ok) setNewNote("");
                }}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </Card>

          {/* Status */}
          {escalation.status !== "resolved" ? (
            <Card className="p-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-black/40">Resolve</p>
              <div className="flex gap-2">
                {escalation.status === "open" && (
                  <Button variant="outline" loading={busy} onClick={() => run(() => markEscalationInProgressAction(escalation.id))}>
                    <Clock3 className="h-4 w-4" /> Mark In Progress
                  </Button>
                )}
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Resolution Notes</label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                  placeholder="What was done to resolve this -- the client and coach will see this"
                  className="w-full rounded-xl border border-black/15 p-3 text-sm"
                />
              </div>
              <Button className="mt-3" loading={busy} onClick={() => run(() => resolveEscalationAction(escalation.id, resolutionNotes || undefined))}>
                <CheckCircle2 className="h-4 w-4" /> Mark Resolved &amp; Close
              </Button>
            </Card>
          ) : (
            <Card className="border-emerald-500/30 bg-emerald-50 p-6">
              <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" /> Resolved
              </p>
              {escalation.resolutionNotes && <p className="mt-2 text-sm text-emerald-800">{escalation.resolutionNotes}</p>}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
