import Image from "next/image";
import { ChevronRight, Users2, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { getCoachClientsAction } from "@/lib/actions/coach-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachClientsPage() {
  const result = await getCoachClientsAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader title="Clients" description="Clients currently assigned to you." />
        <EmptyState icon={AlertTriangle} title="Couldn't load your clients" description={result.error.message} />
      </div>
    );
  }

  const clients = result.data;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Clients" description={`${clients.length} clients currently assigned to you.`} />

      {clients.length === 0 && <EmptyState icon={Users2} title="No clients yet" description="New client assignments will show up here." />}

      <div className="space-y-3">
        {clients.map((c) => (
          <a key={c.id} href={`/coach/clients/${c.id}`}>
            <Card className="flex items-center gap-4 p-4 transition-shadow hover:shadow-soft">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                <Image src={c.photo} alt={c.name} fill className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{c.name}</p>
                <p className="truncate text-xs text-black/45">{c.packageName ?? "No active package"}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-black/30" />
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
