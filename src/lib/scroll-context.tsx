"use client";

import { createContext, useContext, useRef } from "react";

export type ScrollState = {
  progress: number; // 0 - 1 across entire page
  velocity: number;
  scrollY: number;
};

export type ScrollStateRef = React.MutableRefObject<ScrollState>;

const ScrollContext = createContext<ScrollStateRef | null>(null);

export function useScrollStateRef(): ScrollStateRef {
  const ctx = useContext(ScrollContext);
  if (!ctx) {
    throw new Error("useScrollStateRef must be used within SmoothScrollProvider");
  }
  return ctx;
}

export function useCreateScrollStateRef(): ScrollStateRef {
  return useRef<ScrollState>({ progress: 0, velocity: 0, scrollY: 0 });
}

export const ScrollStateContext = ScrollContext;
