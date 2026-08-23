"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";
import { ScrollStateContext, useCreateScrollStateRef } from "@/lib/scroll-context";
import BackgroundScene from "@/components/three/BackgroundScene";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

export default function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const scrollStateRef = useCreateScrollStateRef();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.15,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.1,
    });
    lenisRef.current = lenis;
    // Lenis owns the scroll position via its own RAF loop, so any native
    // `scrollIntoView`/hash jump gets fought and cancelled a frame later --
    // expose the instance so CTA buttons can call `lenis.scrollTo` instead.
    window.__lenis = lenis;

    lenis.on("scroll", ({ scroll, velocity }: { scroll: number; velocity: number }) => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, scroll / max)) : 0;
      scrollStateRef.current.progress = progress;
      scrollStateRef.current.velocity = velocity;
      scrollStateRef.current.scrollY = scroll;
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      if (window.__lenis === lenis) window.__lenis = undefined;
    };
  }, [scrollStateRef]);

  return (
    <ScrollStateContext.Provider value={scrollStateRef}>
      <BackgroundScene />
      {children}
    </ScrollStateContext.Provider>
  );
}
