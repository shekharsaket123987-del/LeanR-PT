"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, MessageCircleWarning } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { MyConcernView, raiseConcernAction } from "@/lib/actions/client-concerns.actions";
import { CONCERN_CATEGORIES } from "@/lib/constants/concern-categories";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, { variant: any; label: string }> = {
  open: { variant: "red", label: "Open" },
  in_progress: { variant: "outline-yellow", label: "In Progress" },
  resolved: { variant: "green", label: "Resolved" },
};

function categoryLabel(value: string | null) {
  return CONCERN_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

export default function MyConcernsClient({ concerns }: { concerns: MyConcernView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(CONCERN_CATEGORIES[0].value);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setBusy(true);
    setError("");
    const reason = categoryLabel(category);
    const result = await raiseConcernAction(category, reason, description || undefined);
    setBusy(false);
    if (isFailure(result)) return setError(result.error.message);
    setDescription("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <div className="mb-5 flex justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Raise a Concern
        </Button>
      </div>

      {concerns.length === 0 && <EmptyState icon={MessageCircleWarning} title="No concerns raised" description="Anything on your mind? We're here to help." />}

      <div className="space-y-3">
        {concerns.map((c) => {
          const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.open;
          return (
            <Card key={c.id} className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant="gray">{categoryLabel(c.category)}</Badge>
                <Badge variant={badge.variant}>{badge.label}</Badge>
                <span className="text-xs text-white/40">{formatDate(c.createdAt)}</span>
              </div>
              {c.description && <p className="text-sm text-white/65">{c.description}</p>}
              {c.status === "resolved" && c.resolutionNotes && (
                <p className="mt-2 rounded-lg bg-emerald-400/15 p-3 text-xs text-emerald-400">
                  <span className="font-bold">Resolution: </span>
                  {c.resolutionNotes}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Raise a Concern">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="glass-faint w-full rounded-xl p-3 text-sm text-white outline-none focus:border-white/20">
              {CONCERN_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-white/40">Details (optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="glass-faint w-full rounded-xl p-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <Button className="w-full" loading={busy} onClick={submit}>
            Submit
          </Button>
        </div>
      </Modal>
    </>
  );
}
