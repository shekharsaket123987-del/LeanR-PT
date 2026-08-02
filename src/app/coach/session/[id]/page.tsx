"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { Video, Mic, PhoneOff, Play, Pause, CheckCircle2, Target, Dumbbell, HeartPulse, FileClock } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge, { AssessmentBadge } from "@/components/ui/Badge";
import { getClient, sessions, sessionsForClient } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const session = sessions.find((s) => s.id === params.id) ?? sessions[0];
  const client = getClient(session.clientId);
  const previousSessions = sessionsForClient(session.clientId).filter(
    (s) => s.status === "completed" && s.id !== session.id
  );

  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  if (!client) return null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title={completed ? "Session Completed" : "In-Session View"}
        description={`${client.name} · ${session.type === "assessment" ? "Assessment Session" : "Regular Session"}`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="relative flex aspect-video items-center justify-center bg-black">
              <Image
                src={`https://picsum.photos/seed/${session.id}-call/900/500`}
                alt="Live session"
                fill
                className="object-cover opacity-80"
              />
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                <span className="text-xs font-bold text-white">LIVE</span>
              </div>
              <div className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1.5 font-mono text-xs font-bold text-white backdrop-blur">
                {mins}:{secs}
              </div>
              <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-3">
                <button
                  onClick={() => setRunning((r) => !r)}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-lg"
                >
                  {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </button>
                <button className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur">
                  <Mic className="h-5 w-5" />
                </button>
                <button className="flex h-11 w-11 items-center justify-center rounded-full bg-red-600 text-white">
                  <PhoneOff className="h-5 w-5" />
                </button>
              </div>
            </div>
          </Card>

          <Card className="mt-6 p-6">
            <p className="mb-1 text-sm font-bold">Session Notes &amp; Remarks</p>
            <p className="mb-4 text-xs text-black/45">
              Cover mobility, strength, weaknesses, pain points, progress, and homework for next session.
            </p>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={6}
              placeholder="e.g. Squat depth improved, still guarding on left knee. Homework: 3x10 banded clamshells daily..."
              className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
              disabled={completed}
            />
            <div className="mt-5 flex justify-end">
              {!completed ? (
                <Button onClick={() => setCompleted(true)}>
                  <CheckCircle2 className="h-4 w-4" /> Mark Completed
                </Button>
              ) : (
                <Button variant="outline" onClick={() => router.push("/coach/dashboard")}>
                  Back to Dashboard
                </Button>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-xl">
                <Image src={client.photo} alt={client.name} fill className="object-cover" />
              </div>
              <div>
                <p className="text-sm font-bold">{client.name}</p>
                <p className="text-xs text-black/45">{client.packageName}</p>
              </div>
            </div>
            {session.type === "assessment" && <div className="mt-3"><AssessmentBadge /></div>}

            <div className="mt-5 space-y-4 border-t border-black/[0.06] pt-4">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <Target className="h-3.5 w-3.5" /> Goals
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {client.goals.map((g) => (
                    <span key={g} className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold">
                      {g}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <HeartPulse className="h-3.5 w-3.5" /> Medical Notes
                </p>
                <p className="text-xs text-black/60">{client.medicalNotes}</p>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <Dumbbell className="h-3.5 w-3.5" /> Equipment
                </p>
                <p className="text-xs text-black/60">{client.equipment.join(", ")}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
              <FileClock className="h-3.5 w-3.5" /> Previous Session Remarks
            </p>
            <div className="space-y-3">
              {previousSessions.slice(0, 2).map((s) => (
                <div key={s.id} className="rounded-lg bg-black/[0.03] p-3">
                  <p className="text-[11px] font-bold text-black/50">{formatDate(s.date)}</p>
                  <p className="mt-1 text-xs text-black/60">{s.remarks}</p>
                </div>
              ))}
              {previousSessions.length === 0 && <p className="text-xs text-black/40">No previous sessions yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
