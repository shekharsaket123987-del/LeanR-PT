import Image from "next/image";
import { ChevronRight, Users2 } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { coaches, clients } from "@/lib/mock-data";

export default function CoachClientsPage() {
  const coach = coaches[0];
  const myClients = clients.filter((c) => c.coachId === coach.id);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Clients" description={`${myClients.length} clients currently assigned to you.`} />

      {myClients.length === 0 && (
        <EmptyState icon={Users2} title="No clients yet" description="New client assignments will show up here." />
      )}

      <div className="space-y-3">
        {myClients.map((c) => (
          <a key={c.id} href={`/coach/clients/${c.id}`}>
            <Card className="flex items-center gap-4 p-4 transition-shadow hover:shadow-soft">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                <Image src={c.photo} alt={c.name} fill className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{c.name}</p>
                <p className="truncate text-xs text-black/45">{c.packageName} · {c.sessionsRemaining} sessions left</p>
              </div>
              <Badge variant={c.status === "active" ? "green" : c.status === "paused" ? "red" : "gray"}>{c.status}</Badge>
              <ChevronRight className="h-4 w-4 shrink-0 text-black/30" />
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
