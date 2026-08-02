import Image from "next/image";
import { Target, HeartPulse, Dumbbell, TrendingUp } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Badge, { AssessmentBadge } from "@/components/ui/Badge";
import { getClient, sessionsForClient } from "@/lib/mock-data";
import { formatDate } from "@/lib/utils";

export default function CoachClientDetailPage({ params }: { params: { id: string } }) {
  const client = getClient(params.id);
  if (!client) return <p className="text-sm text-black/50">Client not found.</p>;
  const history = sessionsForClient(client.id).filter((s) => s.status === "completed");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={client.name} description={`${client.packageName} · Client since ${formatDate(client.joinedDate)}`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl">
              <Image src={client.photo} alt={client.name} fill className="object-cover" />
            </div>
            <div>
              <p className="text-sm font-bold">{client.name}</p>
              <p className="text-xs text-black/45">{client.email}</p>
            </div>
          </div>
          <div className="mt-5 space-y-4 border-t border-black/[0.06] pt-4">
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                <Target className="h-3.5 w-3.5" /> Goals
              </p>
              <div className="flex flex-wrap gap-1.5">
                {client.goals.map((g) => (
                  <span key={g} className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold">{g}</span>
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
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase text-black/40">
                <TrendingUp className="h-3.5 w-3.5" /> Package Progress
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
                <div
                  className="h-full rounded-full bg-brand-yellow"
                  style={{ width: `${(client.sessionsUsed / client.sessionsTotal) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-black/40">{client.sessionsUsed} / {client.sessionsTotal} sessions used</p>
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2">
          <h2 className="text-display mb-4 text-lg font-bold italic">Session History &amp; Notes</h2>
          <div className="space-y-3">
            {history.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  {s.type === "assessment" && <AssessmentBadge />}
                  <Badge variant="gray">{formatDate(s.date)}</Badge>
                  {s.rating && <Badge variant="green">{"★".repeat(s.rating)}</Badge>}
                </div>
                <p className="text-sm text-black/65">{s.remarks}</p>
              </Card>
            ))}
            {history.length === 0 && <p className="text-sm text-black/40">No completed sessions yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
