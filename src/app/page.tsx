import SmoothScrollProvider from "@/components/providers/SmoothScrollProvider";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import TrustBar from "@/components/landing/TrustBar";
import CoachingShowsUp from "@/components/landing/CoachingShowsUp";
import WhatIsLeanR from "@/components/landing/WhatIsLeanR";
import TrainerCarousel from "@/components/landing/TrainerCarousel";
import HowItWorks from "@/components/landing/HowItWorks";
import ReadyWhenYouAre from "@/components/landing/ReadyWhenYouAre";
import PricingSection, { PublicPackage } from "@/components/landing/PricingSection";
import WhyLeanR from "@/components/landing/WhyLeanR";
import Testimonials from "@/components/landing/Testimonials";
import Footer from "@/components/landing/Footer";
import { listPublicActivePackages } from "@/lib/services/packages.service";

export default async function LandingPage() {
  const packageRows = await listPublicActivePackages();

  const packages: PublicPackage[] = (packageRows as any[]).map((p) => ({
    id: p.id,
    name: p.name,
    sessions: p.sessions_count,
    price: Number(p.price),
    originalPrice: p.original_price ? Number(p.original_price) : null,
    features: p.features ?? [],
    highlighted: p.highlighted ?? false,
  }));

  return (
    <SmoothScrollProvider>
      <div className="relative z-10 min-h-screen">
        <Navbar />
        <Hero />
        <TrustBar />
        <CoachingShowsUp />
        <WhatIsLeanR />
        <HowItWorks />
        <TrainerCarousel />
        <ReadyWhenYouAre />
        <PricingSection packages={packages} />
        <WhyLeanR />
        <Testimonials />
        <Footer />
      </div>
    </SmoothScrollProvider>
  );
}
