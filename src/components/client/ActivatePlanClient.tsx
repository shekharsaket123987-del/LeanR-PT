"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { activatePlanAction } from "@/lib/actions/client-journey.actions";
import { isFailure } from "@/lib/actions/action-result";

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function ActivatePlanClient({ subscriptionId, packageName }: { subscriptionId: string; packageName: string | null }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(tomorrowISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function activate() {
    setBusy(true);
    setError("");
    const result = await activatePlanAction(subscriptionId, startDate);
    setBusy(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    router.push("/client/dashboard");
    router.refresh();
  }

  return (
    <Card className="p-6">
      <p className="text-sm font-bold">{packageName ?? "Your Plan"}</p>
      <p className="mt-1 text-xs text-black/50">
        Pick the date your plan starts. This can only be set once -- your coach and session schedule will be set up right after.
      </p>
      <div className="mt-5">
        <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Start Date</label>
        <input type="date" value={startDate} min={tomorrowISO()} onChange={(e) => setStartDate(e.target.value)} className="w-full max-w-xs rounded-xl border border-black/15 p-3 text-sm" />
      </div>
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
      <Button className="mt-6" loading={busy} onClick={activate}>
        Confirm Start Date
      </Button>
    </Card>
  );
}
