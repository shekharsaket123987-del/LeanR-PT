"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Star } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import TagEditor from "@/components/ui/TagEditor";
import {
  AdminSettingsData,
  updateSettingAction,
  createPackageAction,
  updatePackageAction,
  deletePackageAction,
} from "@/lib/actions/admin-settings.actions";
import { isFailure } from "@/lib/actions/action-result";

function settingValue(settings: AdminSettingsData["settings"], key: string, fallback: number): number {
  return settings.find((s) => s.key === key)?.value ?? fallback;
}

const EMPTY_FORM = {
  name: "",
  category: "addon" as "advance" | "addon",
  sessions: 12,
  price: 0,
  originalPrice: 0,
  features: [] as string[],
  highlighted: false,
  defaultPauseDays: 0,
};

export default function AdminSettingsClient({ data }: { data: AdminSettingsData }) {
  const router = useRouter();
  const [duration, setDuration] = useState(settingValue(data.settings, "default_session_duration_minutes", 45));
  const [rescheduleCutoff, setRescheduleCutoff] = useState(settingValue(data.settings, "reschedule_cutoff_hours", 1));
  const [cancellationCutoff, setCancellationCutoff] = useState(settingValue(data.settings, "cancellation_cutoff_hours", 12));
  const [inactivity, setInactivity] = useState(settingValue(data.settings, "inactivity_threshold_days", 30));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState("");

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

  function openAddPackage() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEditPackage(p: AdminSettingsData["packages"][number]) {
    setEditingId(p.id);
    setForm({
      name: p.name,
      category: p.category,
      sessions: p.sessions,
      price: p.price,
      originalPrice: p.originalPrice ?? 0,
      features: p.features,
      highlighted: p.highlighted,
      defaultPauseDays: p.defaultPauseDays,
    });
    setFormError("");
    setFormOpen(true);
  }

  async function savePackage() {
    if (!form.name || form.sessions < 1 || form.price < 0) return;
    setFormBusy(true);
    setFormError("");
    const payload = {
      name: form.name,
      category: form.category,
      sessions_count: form.sessions,
      price: form.price,
      original_price: form.originalPrice > 0 ? form.originalPrice : null,
      features: form.features,
      highlighted: form.highlighted,
      default_pause_days: form.defaultPauseDays,
    };
    const result = editingId ? await updatePackageAction(editingId, payload) : await createPackageAction(payload);
    setFormBusy(false);
    if (isFailure(result)) return setFormError(result.error.message);
    setFormOpen(false);
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
          <Button variant="outline" size="sm" onClick={openAddPackage}>
            <Plus className="h-3.5 w-3.5" /> Add Package
          </Button>
        </div>
        <div className="space-y-2">
          {data.packages.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] px-4 py-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  {p.name}
                  {p.highlighted && <Star className="h-3 w-3 fill-brand-yellow text-brand-yellow" />}
                </p>
                <p className="text-xs text-white/40">
                  {p.sessions} sessions · ₹{p.price.toLocaleString("en-IN")}
                  {p.originalPrice && p.originalPrice > p.price ? ` (was ₹${p.originalPrice.toLocaleString("en-IN")})` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => openEditPackage(p)}>
                  <Pencil className="h-4 w-4 text-white/30 hover:text-white" />
                </button>
                <button onClick={() => setConfirmDeleteTarget({ id: p.id, name: p.name })} disabled={deletingId === p.id}>
                  <Trash2 className="h-4 w-4 text-white/30 hover:text-red-400" />
                </button>
              </div>
            </div>
          ))}
          {data.packages.length === 0 && <p className="text-sm text-white/40">No packages yet.</p>}
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-sm font-bold">Session Rules</p>
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-white/40">
              Default Session Duration <span className="text-white/60">{duration} min</span>
            </label>
            <input type="range" min={30} max={90} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full accent-brand-yellow" />
          </div>
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-white/40">
              Cancellation Cutoff Window <span className="text-white/60">{cancellationCutoff} hrs</span>
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
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-white/40">
              Reschedule Cutoff Window <span className="text-white/60">{rescheduleCutoff} hrs</span>
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
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-white/40">
              Inactivity Threshold <span className="text-white/60">{inactivity} days</span>
            </label>
            <input type="range" min={7} max={90} step={7} value={inactivity} onChange={(e) => setInactivity(Number(e.target.value))} className="w-full accent-brand-yellow" />
          </div>
        </div>
        {saveError && <p className="mt-3 text-xs text-red-400">{saveError}</p>}
        {saved && !saveError && <p className="mt-3 text-xs text-emerald-400">Saved.</p>}
        <Button className="mt-6" loading={saving} onClick={saveSettings}>
          Save Settings
        </Button>
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editingId ? "Edit Package" : "Add Package"}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full glass-faint rounded-xl p-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as "advance" | "addon" }))}
              className="w-full glass-faint rounded-xl p-3 text-sm text-white"
            >
              <option value="addon">Add-on</option>
              <option value="advance">Advance</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Sessions</label>
              <input
                type="number"
                min={1}
                value={form.sessions}
                onChange={(e) => setForm((f) => ({ ...f, sessions: Number(e.target.value) }))}
                className="w-full glass-faint rounded-xl p-3 text-sm text-white"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Price (₹)</label>
              <input
                type="number"
                min={0}
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                className="w-full glass-faint rounded-xl p-3 text-sm text-white"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Original Price (₹, optional — shown struck through)</label>
            <input
              type="number"
              min={0}
              value={form.originalPrice}
              onChange={(e) => setForm((f) => ({ ...f, originalPrice: Number(e.target.value) }))}
              className="w-full glass-faint rounded-xl p-3 text-sm text-white"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Default Pause-Days Allowed</label>
            <input
              type="number"
              min={0}
              value={form.defaultPauseDays}
              onChange={(e) => setForm((f) => ({ ...f, defaultPauseDays: Number(e.target.value) }))}
              className="w-full glass-faint rounded-xl p-3 text-sm text-white"
            />
          </div>
          <TagEditor label="Features" values={form.features} onChange={(v) => setForm((f) => ({ ...f, features: v }))} />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.highlighted}
              onChange={(e) => setForm((f) => ({ ...f, highlighted: e.target.checked }))}
              className="h-4 w-4 accent-brand-yellow"
            />
            Highlight as featured plan
          </label>
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <Button className="w-full" disabled={!form.name} loading={formBusy} onClick={savePackage}>
            {editingId ? "Save Changes" : "Add Package"}
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
