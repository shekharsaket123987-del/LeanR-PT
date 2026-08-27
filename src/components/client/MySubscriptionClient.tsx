"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, PauseCircle, PlayCircle } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import EmptyState from "@/components/ui/EmptyState";
import { MySubscriptionView, pauseMySubscriptionAction, resumeMySubscriptionAction } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

export default function MySubscriptionClient({ subscription }: { subscription: MySubscriptionView }) {
  const router = useRouter();
  const pauseDaysRemaining = Math.max(0, subscription.pauseDaysAllowed - subscription.pauseDaysUsed);
  const [confirmMode, setConfirmMode] = useState<"pause" | "resume" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmAction() {
    if (!subscription.subscriptionId || !confirmMode) return;
    setBusy(true);
    setError("");
    const result =
      confirmMode === "pause"
        ? await pauseMySubscriptionAction(subscription.subscriptionId)
        : await resumeMySubscriptionAction(subscription.subscriptionId);
    setBusy(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    setConfirmMode(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-bold uppercase text-white/40">Current Plan</p>
          {subscription.status && (
            <Badge variant={subscription.status === "active" ? "green" : "red"}>
              {subscription.status === "active" ? "Active" : "Paused"}
            </Badge>
          )}
        </div>
        {subscription.packageName ? (
          <>
            <p className="text-sm font-bold">{subscription.packageName}</p>
            <p className="mt-1 text-xs text-white/45">
              {subscription.sessionsUsed} used · {subscription.sessionsRemaining} remaining of {subscription.sessionsTotal}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-brand-yellow"
                style={{ width: `${Math.min(100, (subscription.sessionsUsed / Math.max(1, subscription.sessionsTotal)) * 100)}%` }}
              />
            </div>
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-white/50">
              {pauseDaysRemaining.toFixed(1)} of {subscription.pauseDaysAllowed} pause-days remaining
            </p>
            <div className="mt-4">
              {subscription.status === "active" ? (
                <Button variant="outline" size="sm" onClick={() => setConfirmMode("pause")}>
                  <PauseCircle className="h-3.5 w-3.5" /> Pause Plan
                </Button>
              ) : subscription.status === "paused" ? (
                <Button size="sm" onClick={() => setConfirmMode("resume")}>
                  <PlayCircle className="h-3.5 w-3.5" /> Resume Plan
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-white/40">No active plan.</p>
        )}
      </Card>

      <div>
        <h2 className="text-display mb-4 text-lg font-bold italic">Payment History</h2>
        {subscription.payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments yet" description="Your purchase history will show up here." />
        ) : (
          <Card className="divide-y divide-white/[0.05]">
            {subscription.payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-bold">{p.packageName}</p>
                  <p className="text-xs text-white/40">{formatDate(p.saleDate)}</p>
                </div>
                <p className="text-sm font-bold">₹{p.amount.toLocaleString("en-IN")}</p>
              </div>
            ))}
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmMode !== null}
        onClose={() => {
          setConfirmMode(null);
          setError("");
        }}
        onConfirm={confirmAction}
        title={confirmMode === "pause" ? "Pause your plan?" : "Resume your plan?"}
        description={
          confirmMode === "pause"
            ? "You won't be able to book new sessions until you resume. Your coach will be notified."
            : "Your plan will become active again and you'll be able to book sessions."
        }
        confirmLabel={confirmMode === "pause" ? "Pause Plan" : "Resume Plan"}
        destructive={confirmMode === "pause"}
        loading={busy}
        error={error}
      />
    </div>
  );
}
