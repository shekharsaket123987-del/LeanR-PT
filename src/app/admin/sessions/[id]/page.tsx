import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Badge, { AssessmentBadge, SessionStatusBadge } from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getAdminSessionDetailAction } from "@/lib/actions/admin-session-detail.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate, formatTime } from "@/lib/utils";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-black/40">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}

export default async function AdminSessionDetailPage({ params }: { params: { id: string } }) {
  const result = await getAdminSessionDetailAction(params.id);

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState icon={AlertTriangle} title="Couldn't load this session" description={result.error.message} />
      </div>
    );
  }

  const s = result.data;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`${s.clientName} · ${s.coachName}`}
        description={`${formatDate(s.scheduledStart)} · ${formatTime(s.scheduledStart)}`}
        action={<SessionStatusBadge status={s.status} />}
      />

      <Card className="p-6">
        <p className="mb-4 text-xs font-bold uppercase text-black/40">Basic Information</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Session ID" value={<span className="font-mono text-xs">{s.id.slice(0, 8)}</span>} />
          <Field label="Client" value={s.clientName} />
          <Field label="Coach" value={s.coachName} />
          <Field label="Coach Employee Code" value={s.coachEmployeeCode ?? "—"} />
          <Field label="Duration" value={`${s.durationMinutes} min`} />
          <Field label="Type" value={s.sessionType === "assessment" ? <AssessmentBadge /> : <Badge variant="gray">Regular</Badge>} />
          <Field label="Source" value={s.wasManuallyAdded ? "Manually added" : "Auto-generated"} />
        </div>
      </Card>

      {(s.wasRescheduled || s.cancelReason || s.noShowParty || s.technicalIssue || s.coachOnLeave) && (
        <Card className="p-6">
          <p className="mb-4 text-xs font-bold uppercase text-black/40">Outcome Detail</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {s.wasRescheduled && s.originalScheduledStart && (
              <Field label="Originally Scheduled" value={`${formatDate(s.originalScheduledStart)} · ${formatTime(s.originalScheduledStart)}`} />
            )}
            {s.noShowParty && <Field label="No-show" value={s.noShowParty === "client" ? "Client absent" : "Coach absent"} />}
            {s.technicalIssue && <Field label="Technical Issue" value="Yes" />}
            {s.coachOnLeave && <Field label="Coach on Leave" value="Yes" />}
            {s.cancelReason && <Field label="Cancellation Reason" value={s.cancelReason} />}
          </div>
        </Card>
      )}

      <Card className="p-6">
        <p className="mb-4 text-xs font-bold uppercase text-black/40">Attendance</p>
        {s.attendance ? (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client Joined" value={s.attendance.clientJoinedAt ? formatTime(s.attendance.clientJoinedAt) : "—"} />
            <Field label="Client Left" value={s.attendance.clientLeftAt ? formatTime(s.attendance.clientLeftAt) : "—"} />
            <Field label="Coach Joined" value={s.attendance.coachJoinedAt ? formatTime(s.attendance.coachJoinedAt) : "—"} />
            <Field label="Coach Left" value={s.attendance.coachLeftAt ? formatTime(s.attendance.coachLeftAt) : "—"} />
          </div>
        ) : (
          <p className="text-sm text-black/45">No attendance recorded yet.</p>
        )}
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-xs font-bold uppercase text-black/40">Coaching Notes</p>
        {s.notes || s.homework ? (
          <div className="space-y-3">
            {s.notes && <Field label="Notes" value={s.notes} />}
            {s.homework && <Field label="Homework" value={s.homework} />}
          </div>
        ) : (
          <p className="text-sm text-black/45">No coaching notes for this session.</p>
        )}
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-xs font-bold uppercase text-black/40">Weekly Progress Snapshot</p>
        {s.progressSnapshot ? (
          <>
            <p className="mb-3 text-[11px] text-black/40">As of {formatDate(s.progressSnapshot.loggedAt)}</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Field label="Weight" value={s.progressSnapshot.weight ?? "—"} />
              <Field label="Body Fat %" value={s.progressSnapshot.bodyFatPct ?? "—"} />
              <Field label="Muscle %" value={s.progressSnapshot.musclePct ?? "—"} />
              <Field label="Waist" value={s.progressSnapshot.waist ?? "—"} />
              <Field label="Chest" value={s.progressSnapshot.chest ?? "—"} />
              <Field label="Hip" value={s.progressSnapshot.hip ?? "—"} />
              <Field label="Arms" value={s.progressSnapshot.arms ?? "—"} />
              <Field label="Thigh" value={s.progressSnapshot.thigh ?? "—"} />
            </div>
          </>
        ) : (
          <p className="text-sm text-black/45">No measurements recorded before this session.</p>
        )}
      </Card>

      {s.escalation && (
        <Card className="border-red-200 bg-red-50 p-6">
          <p className="mb-2 text-xs font-bold uppercase text-red-700">Linked Escalation</p>
          <p className="text-sm text-red-900">{s.escalation.reason}</p>
          <Badge variant={s.escalation.status === "open" ? "red" : "green"} className="mt-2">
            {s.escalation.status}
          </Badge>
        </Card>
      )}
    </div>
  );
}
