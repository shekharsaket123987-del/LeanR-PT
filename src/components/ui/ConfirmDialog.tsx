"use client";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
  loading = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-400/15">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <p className="text-sm text-white/60">{description}</p>
      </div>
      {error && <p className="mt-3 text-xs font-semibold text-red-400">{error}</p>}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant={destructive ? "destructive" : "primary"} onClick={onConfirm} loading={loading} disabled={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
