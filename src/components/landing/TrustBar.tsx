import { ShieldCheck, Users, CalendarCheck, Star } from "lucide-react";

const stats = [
  { icon: Users, value: "120+", label: "Certified Coaches" },
  { icon: CalendarCheck, value: "48,000+", label: "Sessions Completed" },
  { icon: Star, value: "4.9 / 5", label: "Average Client Rating" },
  { icon: ShieldCheck, value: "100%", label: "Certified & Verified" },
];

export default function TrustBar() {
  return (
    <section className="border-y border-black/[0.06] bg-white py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-5 sm:px-8 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/15">
              <s.icon className="h-5 w-5 text-black/70" />
            </div>
            <div>
              <p className="text-display text-xl font-bold italic leading-none">{s.value}</p>
              <p className="mt-1 text-xs font-medium text-black/45">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
