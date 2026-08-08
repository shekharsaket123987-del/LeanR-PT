"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Star, Ban, RefreshCcw, Users2, CalendarClock, Pencil } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import TagEditor from "@/components/ui/TagEditor";
import {
  AdminCoachDetailView,
  ReassignCoachClientsResult,
  reassignCoachClientsAction,
  disableCoachAction,
  blockCoachSlotAction,
  updateCoachAction,
  updateCoachSkillsAction,
} from "@/lib/actions/admin-coach.actions";
import { AdminCoachOption } from "@/lib/actions/admin-coach-change.actions";
import CoachPerformancePanel from "@/components/admin/CoachPerformancePanel";
import CoachWeekCalendar from "@/components/admin/CoachWeekCalendar";
import { CoachPerformance } from "@/lib/services/coachPerformance.service";
import { CoachCalendarSlot } from "@/lib/services/scheduling.service";
import { isFailure } from "@/lib/actions/action-result";

export default function AdminCoachDetailClient({
  coach,
  coaches,
  performance,
  calendar,
}: {
  coach: AdminCoachDetailView;
  coaches: AdminCoachOption[];
  performance: CoachPerformance | null;
  calendar: CoachCalendarSlot[];
}) {
  const router = useRouter();
  const [disableOpen, setDisableOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [reassignSummary, setReassignSummary] = useState<ReassignCoachClientsResult | null>(null);
  const [blockDate, setBlockDate] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(coach.name);
  const [editSpecialization, setEditSpecialization] = useState(coach.specialization ?? "");
  const [editYears, setEditYears] = useState(String(coach.yearsExperience));
  const [editBio, setEditBio] = useState(coach.bio);
  const [editSecondary, setEditSecondary] = useState(coach.secondarySpecializations);
  const [editLanguages, setEditLanguages] = useState(coach.languages);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  function openEdit() {
    setEditName(coach.name);
    setEditSpecialization(coach.specialization ?? "");
    setEditYears(String(coach.yearsExperience));
    setEditBio(coach.bio);
    setEditSecondary(coach.secondarySpecializations);
    setEditLanguages(coach.languages);
    setEditError("");
    setEditOpen(true);
  }

  async function saveEdit() {
    setEditBusy(true);
    setEditError("");
    const result = await updateCoachAction(coach.id, {
      fullName: editName,
      specialization: editSpecialization,
      yearsExperience: Number(editYears) || 0,
      bio: editBio,
      secondarySpecializations: editSecondary,
      languages: editLanguages,
    });
    setEditBusy(false);
    if (isFailure(result)) {
      setEditError(result.error.message);
      return;
    }
    setEditOpen(false);
    router.refresh();
  }

  const [skills, setSkills] = useState(coach.skills);
  const [skillsBusy, setSkillsBusy] = useState(false);
  const [skillsError, setSkillsError] = useState("");
  const [skillsSaved, setSkillsSaved] = useState(false);
  const skillsDirty = JSON.stringify(skills) !== JSON.stringify(coach.skills);

  async function saveSkills() {
    setSkillsBusy(true);
    setSkillsError("");
    setSkillsSaved(false);
    const result = await updateCoachSkillsAction(coach.id, skills);
    setSkillsBusy(false);
    if (isFailure(result)) {
      setSkillsError(result.error.message);
      return;
    }
    setSkillsSaved(true);
    router.refresh();
  }

  async function confirmDisable() {
    setBusy(true);
    const result = await disableCoachAction(coach.id);
    setBusy(false);
    setDisableOpen(false);
    if (!isFailure(result)) router.refresh();
  }

  async function confirmReassign() {
    if (!reassignTo) return;
    setBusy(true);
    setError("");
    setReassignSummary(null);
    const result = await reassignCoachClientsAction(coach.id, reassignTo);
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    setReassignSummary(result.data);
    setReassignTo("");
    if (result.data.failed.length === 0) setReassignOpen(false);
    router.refresh();
  }

  async function confirmBlock() {
    if (!blockDate) return;
    setBusy(true);
    setError("");
    const result = await blockCoachSlotAction(coach.id, blockDate, blockReason || undefined);
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    setBlockOpen(false);
    setBlockDate("");
    setBlockReason("");
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-1">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-xl">
              <Image src={coach.photo} alt={coach.name} fill className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{coach.name}</p>
              <p className="flex items-center gap-1 text-xs text-black/45">
                <Star className="h-3 w-3 fill-brand-yellow text-brand-yellow" /> {coach.rating} ({coach.reviewCount})
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
          {coach.specialization && <p className="mt-3 text-xs text-black/50">{coach.specialization}</p>}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-black/[0.06] pt-4 text-center">
            <div>
              <p className="text-display text-2xl font-bold italic">{coach.activeClients}</p>
              <p className="text-[11px] text-black/40">Active Clients</p>
            </div>
            <div>
              <p className="text-display text-2xl font-bold italic">{coach.utilizationPct}%</p>
              <p className="text-[11px] text-black/40">Utilization</p>
            </div>
          </div>
        </Card>

        {performance && <CoachPerformancePanel performance={performance} />}

        <Card className="p-5">
          <p className="mb-1 text-xs font-bold uppercase text-black/40">Skills</p>
          <p className="mb-3 text-[11px] text-black/40">The coach can only add here — full edit/remove is Admin-only.</p>
          <TagEditor label="Skills" values={skills} onChange={(v) => { setSkills(v); setSkillsSaved(false); }} />
          {skillsError && <p className="mt-2 text-xs text-red-600">{skillsError}</p>}
          {skillsSaved && !skillsDirty && <p className="mt-2 text-xs text-emerald-600">Saved.</p>}
          {skillsDirty && (
            <Button size="sm" className="mt-3 w-full" loading={skillsBusy} onClick={saveSkills}>
              Save Skills
            </Button>
          )}
        </Card>

        <Card className="space-y-2 p-5">
          <p className="mb-1 text-xs font-bold uppercase text-black/40">Admin Controls</p>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setBlockOpen(true)}>
            <CalendarClock className="h-3.5 w-3.5" /> Override / Block Slots
          </Button>
          <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => setReassignOpen(true)}>
            <Users2 className="h-3.5 w-3.5" /> Reassign Clients
          </Button>
          <Button variant="destructive-outline" size="sm" className="w-full justify-start" disabled={coach.status === "inactive"} onClick={() => setDisableOpen(true)}>
            <Ban className="h-3.5 w-3.5" /> Disable Coach
          </Button>
        </Card>
      </div>

      <div className="space-y-6 lg:col-span-2">
        <div>
          <h2 className="text-display mb-4 text-lg font-bold italic">Assigned Clients ({coach.clients.length})</h2>
          <Card className="divide-y divide-black/[0.05]">
            {coach.clients.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-4">
                <div className="relative h-9 w-9 overflow-hidden rounded-full">
                  <Image src={c.photo} alt={c.name} fill className="object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{c.name}</p>
                  <p className="truncate text-xs text-black/40">{c.packageName ?? "No active package"}</p>
                </div>
                {c.sessionsRemaining != null && <Badge variant="gray">{c.sessionsRemaining} left</Badge>}
              </div>
            ))}
            {coach.clients.length === 0 && <p className="p-4 text-sm text-black/40">No clients assigned.</p>}
          </Card>
        </div>

        <div>
          <h2 className="text-display mb-4 text-lg font-bold italic">7-Day Schedule</h2>
          <CoachWeekCalendar slots={calendar} />
        </div>
      </div>

      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title="Override / Block Slot">
        <div className="space-y-4">
          <p className="text-xs text-black/45">Marks {coach.name} fully unavailable for the selected date.</p>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Date</label>
            <input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Reason (optional)</label>
            <input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button className="w-full" disabled={!blockDate} loading={busy} onClick={confirmBlock}>
            Block Slot
          </Button>
        </div>
      </Modal>

      <Modal
        open={reassignOpen}
        onClose={() => {
          setReassignOpen(false);
          setReassignSummary(null);
          setError("");
        }}
        title="Reassign Clients"
      >
        <p className="mb-4 text-sm text-black/50">
          Select a new coach for all of {coach.name}&apos;s active clients. Their recurring slots and upcoming bookings move to
          the new coach.
        </p>
        <select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm">
          <option value="">Select a coach...</option>
          {coaches
            .filter((c) => c.id !== coach.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.specialization ? ` — ${c.specialization}` : ""}
              </option>
            ))}
        </select>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <Button className="mt-4 w-full" disabled={!reassignTo} loading={busy} onClick={confirmReassign}>
          <RefreshCcw className="h-4 w-4" /> Reassign All Clients
        </Button>
        {reassignSummary && (
          <div className="mt-4 space-y-2">
            {reassignSummary.reassignedCount > 0 && (
              <p className="text-xs font-semibold text-emerald-700">
                {reassignSummary.reassignedCount} client{reassignSummary.reassignedCount === 1 ? "" : "s"} reassigned successfully.
              </p>
            )}
            {reassignSummary.failed.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="mb-1 text-xs font-bold text-red-800">
                  {reassignSummary.failed.length} client{reassignSummary.failed.length === 1 ? "" : "s"} couldn&apos;t be moved:
                </p>
                <ul className="space-y-1 text-xs text-red-700">
                  {reassignSummary.failed.map((f) => (
                    <li key={f.clientId}>
                      <span className="font-semibold">{f.clientName}</span> — {f.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Coach">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Name</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-xl border border-black/15 p-2.5 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Specialization</label>
            <input
              value={editSpecialization}
              onChange={(e) => setEditSpecialization(e.target.value)}
              className="w-full rounded-xl border border-black/15 p-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Years of Experience</label>
            <input
              type="number"
              min="0"
              value={editYears}
              onChange={(e) => setEditYears(e.target.value)}
              className="w-full rounded-xl border border-black/15 p-2.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Bio</label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-black/15 p-2.5 text-sm"
            />
          </div>
          <TagEditor label="Additional Specializations" values={editSecondary} onChange={setEditSecondary} />
          <TagEditor label="Languages" values={editLanguages} onChange={setEditLanguages} />
          {editError && <p className="text-xs text-red-600">{editError}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button loading={editBusy} onClick={saveEdit}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        onConfirm={confirmDisable}
        title="Disable this coach?"
        description={`${coach.name} will no longer receive new bookings. Their ${coach.clients.length} assigned clients will need to be reassigned separately.`}
        confirmLabel="Disable Coach"
        loading={busy}
      />
    </div>
  );
}
