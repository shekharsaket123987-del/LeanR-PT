"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatDate } from "@/lib/utils";

export interface MeasurementPoint {
  loggedAt: string;
  weight: number | null;
  bodyFatPct: number | null;
  musclePct: number | null;
  waist: number | null;
  chest: number | null;
  hip: number | null;
  arms: number | null;
  thigh: number | null;
}

type MetricKey = Exclude<keyof MeasurementPoint, "loggedAt">;

const METRICS: { key: MetricKey; label: string; unit: string }[] = [
  { key: "weight", label: "Weight", unit: "kg" },
  { key: "bodyFatPct", label: "Body Fat", unit: "%" },
  { key: "musclePct", label: "Muscle", unit: "%" },
  { key: "waist", label: "Waist", unit: "in" },
  { key: "chest", label: "Chest", unit: "in" },
  { key: "hip", label: "Hip", unit: "in" },
  { key: "arms", label: "Arms", unit: "in" },
  { key: "thigh", label: "Thigh", unit: "in" },
];

/** Weekly measurement trend, shared between the client's own Progress page
 * (§3.9) and the coach/admin client-detail Progress tab (§5.3) rather than
 * built twice, per the spec's explicit instruction. One metric at a time --
 * weight/%/inches don't share a y-axis, so a metric switcher replaces what
 * would otherwise be a dual-axis chart (the #1 chart-design mistake). Single
 * series, so no legend box is needed; the selected metric name already
 * identifies it. Line/dot styling matches the existing admin revenue chart
 * (AdminDashboardClient.tsx) so charts read as one system across the app. */
export default function MeasurementChart({ logs }: { logs: MeasurementPoint[] }) {
  const [metricKey, setMetricKey] = useState<MetricKey>("weight");
  const metric = METRICS.find((m) => m.key === metricKey)!;

  const data = useMemo(
    () =>
      logs
        .filter((l) => l[metricKey] != null)
        .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime())
        .map((l) => ({ date: formatDate(l.loggedAt, { month: "short", day: "numeric" }), value: l[metricKey] as number })),
    [logs, metricKey]
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetricKey(m.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              metricKey === m.key ? "bg-black text-white" : "bg-black/5 text-black/50 hover:bg-black/10"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {data.length < 2 ? (
        <p className="py-10 text-center text-sm text-black/40">
          Log at least 2 weeks of {metric.label.toLowerCase()} to see a trend.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#00000060" }} axisLine={{ stroke: "#00000015" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#00000060" }} axisLine={false} tickLine={false} unit={metric.unit} width={46} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: "1px solid #00000010", fontSize: 12 }}
              formatter={(value: number) => [`${value} ${metric.unit}`, metric.label]}
            />
            <Line type="monotone" dataKey="value" stroke="#111111" strokeWidth={2.5} dot={{ fill: "#F5E400", stroke: "#111111", strokeWidth: 2, r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
