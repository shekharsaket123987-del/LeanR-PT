import Image from "next/image";
import { Target, HeartPulse, Dumbbell, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { getCoachClientDetailAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";
import { formatDate } from "@/lib/utils";

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

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={client.name} description={`${client.packageName ?? "No active package"} · Client since ${formatDate(client.joinedDate)}`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl">
              <Image src={client.photo} alt={client.name} fill className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold">{client.name}</p>
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

        <div className="lg:col-span-2">
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
      </div>
    </div>
  );
}
