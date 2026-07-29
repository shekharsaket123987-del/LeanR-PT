"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { packages } from "@/lib/mock-data";

export default function AdminSettingsPage() {
  const [duration, setDuration] = useState(45);
  const [cutoff, setCutoff] = useState(12);
  const [inactivity, setInactivity] = useState(30);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Platform-wide rules and package configuration." />

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-bold">Package Types</p>
          <Button variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5" /> Add Package
          </Button>
        </div>
        <div className="space-y-2">
          {packages.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-black/[0.06] px-4 py-3">
              <div>
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="text-xs text-black/40">{p.sessions} sessions · ₹{p.price.toLocaleString("en-IN")}</p>
              </div>
              <button>
                <Trash2 className="h-4 w-4 text-black/30 hover:text-red-500" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6">
        <p className="mb-4 text-sm font-bold">Session Rules</p>
        <div className="space-y-5">
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-black/40">
              Default Session Duration <span className="text-black/60">{duration} min</span>
            </label>
            <input
              type="range"
              min={30}
              max={90}
              step={15}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full accent-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-black/40">
              Reschedule / Cancel Cutoff Window <span className="text-black/60">{cutoff} hrs</span>
            </label>
            <input
              type="range"
              min={4}
              max={48}
              step={4}
              value={cutoff}
              onChange={(e) => setCutoff(Number(e.target.value))}
              className="w-full accent-brand-yellow"
            />
          </div>
          <div>
            <label className="mb-1.5 flex justify-between text-xs font-bold uppercase text-black/40">
              Inactivity Threshold <span className="text-black/60">{inactivity} days</span>
            </label>
            <input
              type="range"
              min={7}
              max={90}
              step={7}
              value={inactivity}
              onChange={(e) => setInactivity(Number(e.target.value))}
              className="w-full accent-brand-yellow"
            />
          </div>
        </div>
        <Button className="mt-6">Save Settings</Button>
      </Card>
    </div>
  );
}
