"use client";

import { useRef, useState } from "react";
import { Star, ArrowRight } from "lucide-react";
import Image from "next/image";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
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

function CoachCard({ coach }: { coach: PublicCoach }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), { stiffness: 220, damping: 20 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), { stiffness: 220, damping: 20 });

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  }

  function handleLeave() {
    mx.set(0);
    my.set(0);
    setHovered(false);
  }

  return (
    <div style={{ perspective: 1400 }} className="h-full w-[260px] shrink-0 sm:w-auto">
      <motion.div
        animate={{ scale: hovered ? 1.03 : 1, z: hovered ? 40 : 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        style={{ transformStyle: "preserve-3d" }}
        className="h-full"
      >
        <div ref={ref} onMouseEnter={() => setHovered(true)} onMouseMove={handleMove} onMouseLeave={handleLeave} className="h-full [perspective:1000px]">
          <motion.div
            style={{ rotateX: hovered ? rotateX : 0, rotateY: hovered ? rotateY : 0, transformStyle: "preserve-3d" }}
            className={`group h-full overflow-hidden rounded-2xl glass-strong transition-[border-color,box-shadow] duration-300 ${hovered ? "glow-yellow border-brand-yellow/40" : ""}`}
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
              <p className="text-display text-lg text-white">{coach.name}</p>
              <p className="mt-0.5 text-xs font-medium text-white/50">{coach.specialization}</p>
              <p className="mt-1 text-xs text-white/40">{coach.yearsExperience} years experience</p>
              <Button href="/signup" size="sm" className="mt-4 w-full">
                Book with {coach.name.split(" ")[0]}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

export default function TrainerCarousel({ coaches }: { coaches: PublicCoach[] }) {
  return (
    <section id="coaches" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-yellow/70">Meet the coaches</span>
            <h2 className="text-display mt-2 text-4xl tracking-tight text-white sm:text-5xl">
              Trainers Who Show Up For You
            </h2>
          </div>
          <p className="max-w-sm text-sm text-white/50">
            Every LEANR coach is certified, background-checked, and stays with you for your entire plan.
          </p>
        </div>

        {coaches.length === 0 ? (
          <p className="text-sm text-white/45">Our coaching roster is being updated -- check back shortly.</p>
        ) : (
          <div className="scrollbar-none -mx-5 flex gap-5 overflow-x-auto px-5 pb-4 pt-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-4" style={{ perspective: 1600 }}>
            {coaches.map((coach) => (
              <CoachCard key={coach.id} coach={coach} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
