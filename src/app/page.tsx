import SmoothScrollProvider from "@/components/providers/SmoothScrollProvider";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import TrustBar from "@/components/landing/TrustBar";
import TrainerCarousel, { PublicCoach } from "@/components/landing/TrainerCarousel";
import HowItWorks from "@/components/landing/HowItWorks";
import PricingSection, { PublicPackage } from "@/components/landing/PricingSection";
import Testimonials from "@/components/landing/Testimonials";
import Footer from "@/components/landing/Footer";
import { listPublicActiveCoaches } from "@/lib/services/coaches.service";
import { listPublicActivePackages } from "@/lib/services/packages.service";

const FALLBACK_PHOTO = (seed: string) => `https://picsum.photos/seed/${seed}-action/400/500`;

export default async function LandingPage() {
  const [coachRows, packageRows] = await Promise.all([listPublicActiveCoaches(), listPublicActivePackages()]);

  const coaches: PublicCoach[] = (coachRows as any[]).map((c) => ({
    id: c.id,
    name: c.profile?.full_name ?? "Coach",
    photo: c.profile?.photo_url ?? FALLBACK_PHOTO(c.id),
    specialization: c.specialization ?? "",
    yearsExperience: c.years_experience ?? 0,
    rating: c.rating ?? 0,
    reviewCount: c.review_count ?? 0,
  }));

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
        <TrainerCarousel coaches={coaches} />
        <HowItWorks />
        <PricingSection packages={packages} />
        <Testimonials />
        <Footer />
      </div>
    </SmoothScrollProvider>
  );
}
