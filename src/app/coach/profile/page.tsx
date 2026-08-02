import Image from "next/image";
import { Award, Languages, Camera } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { coaches } from "@/lib/mock-data";

export default function CoachProfilePage() {
  const coach = coaches[0];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" description="How clients see you across LEANR." />

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <div className="group relative h-20 w-20 overflow-hidden rounded-2xl">
            <Image src={coach.photo} alt={coach.name} fill className="object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <p className="text-display text-xl font-bold italic">{coach.name}</p>
            <p className="text-sm text-black/45">{coach.specialization}</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto">Edit</Button>
        </div>

        <div className="mt-6 border-t border-black/[0.06] pt-6">
          <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Bio</label>
          <p className="text-sm text-black/60">{coach.bio}</p>
        </div>

        <div className="mt-6 border-t border-black/[0.06] pt-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-black/40">
            <Award className="h-3.5 w-3.5" /> Certifications
          </p>
          <div className="flex flex-wrap gap-2">
            {coach.certifications.map((c) => (
              <span key={c} className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold">{c}</span>
            ))}
          </div>
        </div>

        <div className="mt-6 border-t border-black/[0.06] pt-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-black/40">
            <Languages className="h-3.5 w-3.5" /> Languages
          </p>
          <div className="flex flex-wrap gap-2">
            {coach.languages.map((c) => (
              <span key={c} className="rounded-full bg-black/5 px-3 py-1 text-xs font-semibold">{c}</span>
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-black/[0.06] pt-6">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Specialization</label>
            <input defaultValue={coach.specialization} className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase text-black/40">Years of Experience</label>
            <input defaultValue={coach.yearsExperience} className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow" />
          </div>
        </div>
      </Card>
    </div>
  );
}
