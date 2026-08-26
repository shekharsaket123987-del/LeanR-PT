"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ScheduleSetupClient from "./ScheduleSetupClient";
import { ScheduleSetupOptions } from "@/lib/actions/schedule.actions";

const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function ChangeScheduleClient({ options }: { options: ScheduleSetupOptions }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <ScheduleSetupClient options={options} scheduleMode="change" />;
  }

  return (
    <Card className="p-6">
      <p className="text-sm font-bold">You already have an active recurring schedule</p>
      <ul className="mt-3 space-y-1 text-sm text-white/60">
        {(options.existingSchedule ?? []).map((s, i) => (
          <li key={i}>
            {DAY_LABELS[s.dayOfWeek]} at {s.startTime.slice(0, 5)}
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => setEditing(true)}>
        Change My Schedule
      </Button>
    </Card>
  );
}
