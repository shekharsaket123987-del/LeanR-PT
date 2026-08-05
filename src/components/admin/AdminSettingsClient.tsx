"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  AdminSettingsData,
  updateSettingAction,
  createPackageAction,
  deletePackageAction,
} from "@/lib/actions/admin-settings.actions";
import { isFailure } from "@/lib/actions/action-result";

function settingValue(settings: AdminSettingsData["settings"], key: string, fallback: number): number {
  return settings.find((s) => s.key === key)?.value ?? fallback;
}

export default function AdminSettingsClient({ data }: { data: AdminSettingsData }) {
  const router = useRouter();
  const [duration, setDuration] = useState(settingValue(data.settings, "default_session_duration_minutes", 45));
  const [rescheduleCutoff, setRescheduleCutoff] = useState(settingValue(data.settings, "reschedule_cutoff_hours", 1));
  const [cancellationCutoff, setCancellationCutoff] = useState(settingValue(data.settings, "cancellation_cutoff_hours", 12));
  const [inactivity, setInactivity] = useState(settingValue(data.settings, "inactivity_threshold_days", 30));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<"advance" | "addon">("addon");
  const [newSessions, setNewSessions] = useState(12);
  const [newPrice, setNewPrice] = useState(0);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState("");

  async function saveSettings() {
    setSaving(true);
    setSaveError("");
    setSaved(false);
    const results = await Promise.all([
      updateSettingAction("default_session_duration_minutes", duration),
      updateSettingAction("reschedule_cutoff_hours", rescheduleCutoff),
      updateSettingAction("cancellation_cutoff_hours", cancellationCutoff),
      updateSettingAction("inactivity_threshold_days", inactivity),
    ]);
    setSaving(false);
    const failed = results.find(isFailure);
    if (failed) {
      setSaveError(failed.error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function addPackage() {
    if (!newName || newSessions < 1 || newPrice < 0) return;
    setAddBusy(true);
    setAddError("");
    const result = await createPackageAction({ name: newName, category: newCategory, sessions_count: newSessions, price: newPrice, features: [] });
    setAddBusy(false);
    if (isFailure(result)) return setAddError(result.error.message);
    setAddOpen(false);
    setNewName("");
    setNewSessions(12);
    setNewPrice(0);
    router.refresh();
  }

  async function confirmDeletePackage() {
    if (!confirmDeleteTarget) return;
    setDeletingId(confirmDeleteTarget.id);
    setDeleteError("");
    const result = await deletePackageAction(confirmDeleteTarget.id);
    setDeletingId(null);
    if (isFailure(result)) {
      setDeleteError(result.error.message);
      return;
    }
    setConfirmDeleteTarget(null);
    router.refresh();
  }

  return (
    <>
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">Package Types</p>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add Package
          </Button>
        </div>
        <div className="space-y-2">
          {data.packages.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-black/[0.06] px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-black/40">
                  {p.sessions} sessions · ₹{p.price.toLocaleString("en-IN")}
                </p>
              </div>
              <button onClick={() => setConfirmDeleteTarget({ id: p.id, name: p.name })} disabled={deletingId === p.id}>
                <Trash2 className="h-4 w-4 text-black/30 hover:text-red-500" />
              </button>
            </div>
          ))}
          {data.packages.length === 0 && <p className="text-sm text-black/40">No packages yet.</p>}
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-sm font-bold">Session Rules</p>
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-black/40">
              Default Session Duration <span className="text-black/60">{duration} min</span>
            </label>
            <input type="range" min={30} max={90} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full accent-brand-yellow" />
          </div>
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-black/40">
              Cancellation Cutoff Window <span className="text-black/60">{cancellationCutoff} hrs</span>
            </label>
            <input
              type="range"
              min={4}
              max={48}
              step={4}
              value={cancellationCutoff}
              onChange={(e) => setCancellationCutoff(Number(e.target.value))}
              className="w-full accent-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-black/40">
              Reschedule Cutoff Window <span className="text-black/60">{rescheduleCutoff} hrs</span>
            </label>
            <input
              type="range"
              min={1}
              max={24}
              step={1}
              value={rescheduleCutoff}
              onChange={(e) => setRescheduleCutoff(Number(e.target.value))}
              className="w-full accent-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-black/40">
              Inactivity Threshold <span className="text-black/60">{inactivity} days</span>
            </label>
            <input type="range" min={7} max={90} step={7} value={inactivity} onChange={(e) => setInactivity(Number(e.target.value))} className="w-full accent-brand-yellow" />
          </div>
        </div>
        {saveError && <p className="mt-3 text-xs text-red-600">{saveError}</p>}
        {saved && !saveError && <p className="mt-3 text-xs text-emerald-600">Saved.</p>}
        <Button className="mt-6" loading={saving} onClick={saveSettings}>
          Save Settings
        </Button>
      </Card>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Package">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-xl border border-black/15 p-3 text-sm" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Category</label>
            <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as "advance" | "addon")} className="w-full rounded-xl border border-black/15 p-3 text-sm">
              <option value="addon">Add-on</option>
              <option value="advance">Advance</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Sessions</label>
              <input type="number" min={1} value={newSessions} onChange={(e) => setNewSessions(Number(e.target.value))} className="w-full rounded-xl border border-black/15 p-3 text-sm" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Price (₹)</label>
              <input type="number" min={0} value={newPrice} onChange={(e) => setNewPrice(Number(e.target.value))} className="w-full rounded-xl border border-black/15 p-3 text-sm" />
            </div>
          </div>
          {addError && <p className="text-xs text-red-600">{addError}</p>}
          <Button className="w-full" disabled={!newName} loading={addBusy} onClick={addPackage}>
            Add Package
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteTarget}
        onClose={() => {
          setConfirmDeleteTarget(null);
          setDeleteError("");
        }}
        onConfirm={confirmDeletePackage}
        title="Delete Package"
        description={`Delete "${confirmDeleteTarget?.name}"? Clients with an active subscription on this package keep it -- this only stops it from being offered to new purchases.`}
        confirmLabel="Delete"
        loading={deletingId === confirmDeleteTarget?.id}
        error={deleteError}
      />
    </>
  );
}
