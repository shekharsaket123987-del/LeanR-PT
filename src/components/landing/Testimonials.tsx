import { Star, Quote, PlayCircle } from "lucide-react";
import Image from "next/image";
import { testimonials } from "@/lib/mock-data";

export default function Testimonials() {
  return (
    <section id="stories" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-14 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-yellow/70">Success stories</span>
          <h2 className="text-display mt-2 text-4xl tracking-tight text-white sm:text-5xl">
            Real Results, Real People
          </h2>
        </div>

        <div className="mb-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.id} className="rounded-2xl glass-strong p-6">
              <Quote className="h-7 w-7 text-brand-yellow" fill="#F5D90A" />
              <p className="mt-4 text-sm leading-relaxed text-white/70">&ldquo;{t.quote}&rdquo;</p>
              <div className="mt-6 flex items-center gap-3">
                <div className="relative h-11 w-11 overflow-hidden rounded-full">
                  <Image src={t.photo} alt={t.name} fill className="object-cover" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="text-xs text-white/40">Coached by {t.coachName}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-4">
                <span className="text-xs font-bold text-emerald-400">{t.result}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-brand-yellow text-brand-yellow" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {["transform-1", "transform-2", "transform-3"].map((seed) => (
            <div key={seed} className="group relative h-56 overflow-hidden rounded-2xl">
              <Image src={`https://picsum.photos/seed/${seed}/500/400`} alt="Client transformation story" fill className="object-cover" />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity group-hover:bg-black/50">
                <PlayCircle className="h-14 w-14 text-white/90" />
              </div>
              <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white backdrop-blur">
                Before / After
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
