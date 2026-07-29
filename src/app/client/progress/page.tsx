"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Badge, { AssessmentBadge } from "@/components/ui/Badge";
import { clients, sessionsForClient } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

const monthly = [
  { month: "Apr", sessions: 3 },
  { month: "May", sessions: 5 },
  { month: "Jun", sessions: 6 },
  { month: "Jul", sessions: 4 },
];

export default function ProgressPage() {
  const client = clients[0];
  const history = sessionsForClient(client.id)
    .filter((s) => s.status === "completed")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Progress" description="Your journey with LEANR, tracked session by session." />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Card className="p-5 text-center">
          <p className="text-display text-4xl font-bold italic">{client.streak}</p>
          <p className="mt-1 text-xs font-medium text-black/45">Week Streak</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-display text-4xl font-bold italic">{history.length}</p>
          <p className="mt-1 text-xs font-medium text-black/45">Sessions Completed</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-display text-4xl font-bold italic">96%</p>
          <p className="mt-1 text-xs font-medium text-black/45">Attendance Rate</p>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <p className="mb-4 text-sm font-bold">Sessions per Month</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={monthly}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#00000066" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#00000066" }} width={24} />
            <Tooltip
              cursor={{ fill: "#0000000A" }}
              contentStyle={{ borderRadius: 12, border: "1px solid #00000010", fontSize: 12 }}
            />
            <Bar dataKey="sessions" fill="#F5E400" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="mt-8">
        <h2 className="text-display mb-4 text-xl font-bold italic">Session History &amp; Coach Notes</h2>
        <div className="space-y-3">
          {history.map((s) => (
            <Card key={s.id} className="p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {s.type === "assessment" && <AssessmentBadge />}
                <Badge variant="gray">{formatDate(s.date)}</Badge>
                {s.rating && <Badge variant="green">{"★".repeat(s.rating)}</Badge>}
              </div>
              {s.remarks && <p className="text-sm text-black/65">{s.remarks}</p>}
              {s.feedback && <p className="mt-2 text-xs italic text-black/40">Your feedback: &ldquo;{s.feedback}&rdquo;</p>}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
