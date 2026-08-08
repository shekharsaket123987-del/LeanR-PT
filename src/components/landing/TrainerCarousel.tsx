import { Star, ArrowRight } from "lucide-react";
import Image from "next/image";
import Button from "../ui/Button";

export interface PublicCoach {
  id: string;
  name: string;
  photo: string;
  specialization: string;
  yearsExperience: number;
  rating: number;
  reviewCount: number;
}

export default function TrainerCarousel({ coaches }: { coaches: PublicCoach[] }) {
  return (
    <section id="coaches" className="bg-[#FAFAFA] py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-black/40">Meet the coaches</span>
            <h2 className="text-display mt-2 text-4xl font-bold italic tracking-tight sm:text-5xl">
              Trainers Who Show Up For You
            </h2>
          </div>
          <p className="max-w-sm text-sm text-black/50">
            Every LEANR coach is certified, background-checked, and stays with you for your entire plan.
          </p>
        </div>

        {coaches.length === 0 ? (
          <p className="text-sm text-black/45">Our coaching roster is being updated -- check back shortly.</p>
        ) : (
          <div className="scrollbar-none -mx-5 flex gap-5 overflow-x-auto px-5 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4">
            {coaches.map((coach) => (
              <div
                key={coach.id}
                className="group w-[260px] shrink-0 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card transition-shadow hover:shadow-soft sm:w-auto"
              >
                <div className="relative h-64 w-full overflow-hidden">
                  <Image src={coach.photo} alt={coach.name} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur">
                    <Star className="h-3 w-3 fill-brand-yellow text-brand-yellow" />
                    <span className="text-xs font-bold text-white">{coach.rating}</span>
                    <span className="text-[10px] text-white/60">({coach.reviewCount})</span>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-display text-lg font-bold italic">{coach.name}</p>
                  <p className="mt-0.5 text-xs font-medium text-black/50">{coach.specialization}</p>
                  <p className="mt-1 text-xs text-black/40">{coach.yearsExperience} years experience</p>
                  <Button href="/signup" size="sm" className="mt-4 w-full">
                    Book with {coach.name.split(" ")[0]}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
