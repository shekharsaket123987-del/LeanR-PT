"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCircle, Radio, Volume2, VolumeX } from "lucide-react";
import Button from "../ui/Button";
import Image from "next/image";

const POSTER_SRC = "https://picsum.photos/seed/leanr-hero-training/900/1000";
const VIDEO_SRC = "/videos/hero-training.mp4";

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [muted, setMuted] = useState(true);

  // Respect reduced-motion preference — fall back to the static poster instead
  // of an autoplaying loop.
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) setVideoFailed(true);
  }, []);

  const showVideo = !videoFailed;

  return (
    <section className="relative overflow-hidden bg-black pb-20 pt-16 sm:pb-28 sm:pt-24">
      <div className="pointer-events-none absolute -top-32 right-0 h-[500px] w-[500px] rounded-full bg-brand-yellow/10 blur-[120px]" />
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
        <div className="relative z-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-yellow/30 bg-brand-yellow/10 px-3.5 py-1.5">
            <Radio className="h-3.5 w-3.5 text-brand-yellow" />
            <span className="text-xs font-bold uppercase tracking-wide text-brand-yellow">Live 1:1 Coaching</span>
          </div>
          <h1 className="text-display text-5xl font-bold italic leading-[1.05] text-white sm:text-6xl lg:text-7xl">
            Train Live.
            <br />
            <span className="text-brand-yellow">Anywhere.</span>
          </h1>
          <p className="mt-6 max-w-md text-lg text-white/60">
            Real coaches. Real-time coaching. LEANR pairs you with a dedicated personal trainer for live online
            sessions built around your goals — no gym required.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button href="/signup" size="lg">
              Book Your First Session
            </Button>
            <Button variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/5">
              <PlayCircle className="h-5 w-5" />
              Watch How it Works
            </Button>
          </div>
          <div className="mt-12 flex items-center gap-8">
            <div>
              <p className="text-display text-3xl font-bold italic text-white">120+</p>
              <p className="text-xs font-medium text-white/40">Certified Coaches</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-display text-3xl font-bold italic text-white">48K+</p>
              <p className="text-xs font-medium text-white/40">Sessions Completed</p>
            </div>
            <div className="h-8 w-px bg-white/10" />
            <div>
              <p className="text-display text-3xl font-bold italic text-white">4.9<span className="text-lg">★</span></p>
              <p className="text-xs font-medium text-white/40">Average Rating</p>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <div className="relative h-[460px] w-full overflow-hidden rounded-2xl border border-white/10 shadow-glow sm:h-[560px]">
            {/* Poster image — always in the DOM as the fallback/loading state so
                there's zero regression if hero-training.mp4 hasn't been added yet. */}
            <Image
              src={POSTER_SRC}
              alt="Coach leading a live training session"
              fill
              className={`object-cover transition-opacity duration-500 ${showVideo && videoReady ? "opacity-0" : "opacity-100"}`}
              priority
            />

            {showVideo && (
              <video
                ref={videoRef}
                className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${videoReady ? "opacity-100" : "opacity-0"}`}
                autoPlay
                muted={muted}
                loop
                playsInline
                preload="auto"
                poster={POSTER_SRC}
                onCanPlay={() => setVideoReady(true)}
                onError={() => setVideoFailed(true)}
              >
                <source src={VIDEO_SRC} type="video/mp4" />
              </video>
            )}

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            {/* Video call UI overlay — visually frames the training clip as a live 1:1 session */}
            <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-xs font-bold text-white">LIVE · 24:18</span>
            </div>

            {showVideo && videoReady && (
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? "Unmute preview" : "Mute preview"}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-black/80"
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            )}

            <div className="absolute bottom-4 right-4 h-24 w-20 overflow-hidden rounded-xl border-2 border-white/80 shadow-lg sm:h-28 sm:w-24">
              <Image
                src="https://picsum.photos/seed/leanr-client-cam/200/240"
                alt="Client on live call"
                fill
                className="object-cover"
              />
            </div>
            <div className="absolute bottom-4 left-4 rounded-xl bg-white/95 px-4 py-3 shadow-lg">
              <p className="text-sm font-bold">Arjun Mehta</p>
              <p className="text-xs text-black/50">Strength & Conditioning</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
