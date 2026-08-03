import Image from "next/image";
import { Target, HeartPulse, Dumbbell, AlertTriangle, User, Ruler, Weight, Goal } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ClientTimeline from "@/components/admin/ClientTimeline";
import { getCoachClientDetailAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

const GENDER_LABEL: Record<string, string> = { male: "Male", female: "Female", other: "Other" };
const GOAL_LABEL: Record<string, string> = {
  fat_loss: "Fat Loss",
  muscle_gain: "Muscle Gain",
  strength: "Strength",
  general_fitness: "General Fitness",
  rehabilitation: "Rehabilitation",
};

export default async function CoachClientDetailPage({ params }: { params: { id: string } }) {
  const result = await getCoachClientDetailAction(params.id);

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState icon={AlertTriangle} title="Couldn't load this client" description={result.error.message} />
      </div>
    );
  }

  const client = result.data;
  const d = client.demographics;
  const hasProgress = client.weeklyProgress.some((m) => m.start != null || m.current != null);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={client.name} description={`${client.packageName ?? "No active package"} · Client since ${formatDate(client.joinedDate)}`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 overflow-hidden rounded-xl">
                <Image src={client.photo} alt={client.name} fill className="object-cover" />
              </div>
              <div>
                <p className="text-sm font-bold">{client.name}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-black/[0.06] pt-4 text-xs">
              <div className="flex items-center gap-1.5 text-black/60">
                <User className="h-3.5 w-3.5 text-black/35" /> {d?.age ? `${d.age} yrs` : "Age —"}
              </div>
              <div className="flex items-center gap-1.5 text-black/60">
                {d?.gender ? GENDER_LABEL[d.gender] ?? d.gender : "Gender —"}
              </div>
              <div className="flex items-center gap-1.5 text-black/60">
                <Ruler className="h-3.5 w-3.5 text-black/35" /> {d?.heightCm ? `${d.heightCm} cm` : "Height —"}
              </div>
              <div className="flex items-center gap-1.5 text-black/60">
                <Weight className="h-3.5 w-3.5 text-black/35" /> {d?.weightKg ? `${d.weightKg} kg` : "Weight —"}
              </div>
              <div className="col-span-2 flex items-center gap-1.5 text-black/60">
                <Goal className="h-3.5 w-3.5 text-black/35" /> {d?.fitnessGoal ? GOAL_LABEL[d.fitnessGoal] ?? d.fitnessGoal : "Goal —"}
              </div>
            </div>

            <div className="mt-5 space-y-4 border-t border-black/[0.06] pt-4">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <Target className="h-3.5 w-3.5" /> Goals
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {client.goals.length === 0 && <span className="text-xs text-black/40">Not set</span>}
                  {client.goals.map((g) => (
                    <span key={g} className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold">{g}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <HeartPulse className="h-3.5 w-3.5" /> Medical Notes
                </p>
                <p className="text-xs text-black/60">{client.medicalNotes || "None on file"}</p>
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                  <Dumbbell className="h-3.5 w-3.5" /> Equipment
                </p>
                <p className="text-xs text-black/60">{client.equipment.length > 0 ? client.equipment.join(", ") : "None on file"}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <p className="mb-3 text-xs font-bold uppercase text-black/40">Session Summary</p>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-black/[0.03] p-3">
                <p className="text-display text-xl font-bold italic">{client.sessionSummary.purchased}</p>
                <p className="text-[11px] text-black/45">Purchased</p>
              </div>
              <div className="rounded-xl bg-black/[0.03] p-3">
                <p className="text-display text-xl font-bold italic">{client.sessionSummary.completed}</p>
                <p className="text-[11px] text-black/45">Completed</p>
              </div>
              <div className="rounded-xl bg-black/[0.03] p-3">
                <p className="text-display text-xl font-bold italic">{client.sessionSummary.remaining}</p>
                <p className="text-[11px] text-black/45">Remaining</p>
              </div>
              <div className="rounded-xl bg-black/[0.03] p-3">
                <p className="text-display text-xl font-bold italic">{client.sessionSummary.upcoming}</p>
                <p className="text-[11px] text-black/45">Upcoming</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-8 lg:col-span-2">
          <div>
            <h2 className="text-display mb-4 text-lg font-bold italic">Weekly Progress</h2>
            {!hasProgress ? (
              <p className="text-sm text-black/40">No measurements logged yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {client.weeklyProgress.map((m) => (
                  <Card key={m.label} className="p-3.5">
                    <p className="text-[11px] font-bold uppercase text-black/40">{m.label}</p>
                    <p className="mt-1 text-sm text-black/60">
                      {m.start ?? "—"} → {m.current ?? "—"}
                    </p>
                    {m.diff != null && (
                      <p className={`mt-0.5 text-xs font-bold ${m.diff <= 0 ? "text-emerald-600" : "text-black/50"}`}>
                        {m.diff > 0 ? "+" : ""}
                        {m.diff}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-display mb-4 text-lg font-bold italic">Session History &amp; Notes</h2>
            <div className="space-y-3">
              {client.history.map((s) => (
                <Card key={s.id} className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="gray">{formatDate(s.date)}</Badge>
                    {s.rating && <Badge variant="green">{"★".repeat(s.rating)}</Badge>}
                  </div>
                  <p className="text-sm text-black/65">{s.notes ?? "No notes recorded."}</p>
                </Card>
              ))}
              {client.history.length === 0 && <p className="text-sm text-black/40">No completed sessions yet.</p>}
            </div>
          </div>

          <div>
            <h2 className="text-display mb-4 text-lg font-bold italic">Progress Timeline</h2>
            <ClientTimeline events={client.timeline} />
          </div>
        </div>
      </div>
    </div>
  );
}
