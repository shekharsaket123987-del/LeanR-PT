import SmoothScrollProvider from "@/components/landing/SmoothScrollProvider";

/**
 * Public marketing/login/signup routes only. The authenticated portals
 * (admin/client/coach) sit outside this route group and never get the
 * Lenis smooth-scroll or ambient 3D background -- see BackgroundScene.tsx
 * and SmoothScrollProvider.tsx for why.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <SmoothScrollProvider>{children}</SmoothScrollProvider>;
}
