import { Mail, Phone, Target, Dumbbell, HeartPulse } from "lucide-react";
import Image from "next/image";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { clients } from "@/lib/mock-data";

export default function ClientProfilePage() {
  const client = clients[0];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" description="Manage your personal and health information." />

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-2xl">
            <Image src={client.photo} alt={client.name} fill className="object-cover" />
          </div>
          <div>
            <p className="text-display text-xl font-bold italic">{client.name}</p>
            <p className="text-sm text-black/45">{client.packageName}</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto">
            Edit
          </Button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-black/[0.06] pt-6 sm:grid-cols-2">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-black/40" />
            {client.email}
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-black/40" />
            {client.phone}
          </div>
        </div>

        <div className="mt-6 border-t border-black/[0.06] pt-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-black/40">
            <Target className="h-3.5 w-3.5" /> Goals
          </p>
          <div className="flex flex-wrap gap-2">
            {client.goals.map((g) => (
              <span key={g} className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold">
                {g}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-black/[0.06] pt-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-black/40">
            <Dumbbell className="h-3.5 w-3.5" /> Equipment
          </p>
          <div className="flex flex-wrap gap-2">
            {client.equipment.map((g) => (
              <span key={g} className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold">
                {g}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-black/[0.06] pt-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-black/40">
            <HeartPulse className="h-3.5 w-3.5" /> Medical Notes
          </p>
          <p className="text-sm text-black/60">{client.medicalNotes}</p>
        </div>
      </Card>
    </div>
  );
}
