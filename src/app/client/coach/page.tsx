"use client";

import { useState } from "react";
import Image from "next/image";
import { Star, Award, Languages, Users, AlertCircle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { clients, getCoach } from "@/lib/mock-data";

export default function MyCoachPage() {
  const client = clients[0];
  const coach = getCoach(client.coachId)!;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="My Coach" description="Your dedicated coach for this plan." />

      {submitted && (
        <Card className="mb-6 border-brand-yellow bg-brand-yellow/10 p-4">
          <p className="flex items-center gap-2 text-sm font-bold">
            <AlertCircle className="h-4 w-4" />
            Your request is being reviewed by our team — {coach.name} stays assigned as your coach until this is resolved.
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="relative h-48 w-full">
          <Image src={`https://picsum.photos/seed/${coach.id}-cover/900/300`} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-black/30" />
        </div>
        <div className="relative -mt-14 px-6">
          <div className="relative h-28 w-28 overflow-hidden rounded-2xl border-4 border-white shadow-soft">
            <Image src={coach.photo} alt={coach.name} fill className="object-cover" />
          </div>
        </div>
        <div className="p-6 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-display text-2xl font-bold italic">{coach.name}</p>
            <Badge variant="green">
              <Star className="h-3 w-3 fill-current" /> {coach.rating} ({coach.reviewCount})
            </Badge>
          </div>
          <p className="mt-1 text-sm font-medium text-black/50">{coach.specialization}</p>
          <p className="mt-4 text-sm leading-relaxed text-black/65">{coach.bio}</p>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-black/[0.03] p-4">
              <Award className="mb-2 h-4 w-4 text-black/50" />
              <p className="text-xs font-bold uppercase text-black/40">Certifications</p>
              <p className="mt-1 text-xs text-black/60">{coach.certifications.join(", ")}</p>
            </div>
            <div className="rounded-xl bg-black/[0.03] p-4">
              <Languages className="mb-2 h-4 w-4 text-black/50" />
              <p className="text-xs font-bold uppercase text-black/40">Languages</p>
              <p className="mt-1 text-xs text-black/60">{coach.languages.join(", ")}</p>
            </div>
            <div className="rounded-xl bg-black/[0.03] p-4">
              <Users className="mb-2 h-4 w-4 text-black/50" />
              <p className="text-xs font-bold uppercase text-black/40">Experience</p>
              <p className="mt-1 text-xs text-black/60">{coach.yearsExperience} years coaching</p>
            </div>
          </div>

          <div className="mt-8 border-t border-black/[0.06] pt-6">
            <p className="text-sm font-bold">Not the right fit?</p>
            <p className="mt-1 text-xs text-black/45">
              You can request a coach change. Our team reviews every request personally.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
              Request Coach Change
            </Button>
          </div>
        </div>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Request Coach Change">
        <p className="mb-4 text-sm text-black/50">
          Tell us why you'd like to switch coaches. {coach.name} will remain your coach until our team resolves this
          request.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="e.g. Scheduling conflict, prefer a different training style..."
          className="w-full rounded-xl border border-black/15 p-3 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
        />
        <div className="mt-5 flex justify-end gap-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!reason.trim()}
            onClick={() => {
              setOpen(false);
              setSubmitted(true);
            }}
          >
            Submit Request
          </Button>
        </div>
      </Modal>
    </div>
  );
}
