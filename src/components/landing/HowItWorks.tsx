import { PackageSearch, UserCheck2, CalendarClock, Video, LineChart } from "lucide-react";

const steps = [
  { icon: PackageSearch, title: "Choose Package", description: "Pick LeanR Advance or a PT Add-on tier that fits your goals." },
  { icon: UserCheck2, title: "Choose Coach", description: "Get matched with a certified coach who stays with you the whole way." },
  { icon: CalendarClock, title: "Pick Schedule", description: "Choose recurring slots that fit your week — as simple or custom as you need." },
  { icon: Video, title: "Join Live Session", description: "Train 1:1 over live video — real-time form checks, real coaching." },
  { icon: LineChart, title: "Track Progress", description: "See your streak, session history, and coach remarks after every workout." },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-black py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mb-14 text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-yellow">The process</span>
          <h2 className="text-display mt-2 text-4xl font-bold italic tracking-tight text-white sm:text-5xl">
            How LEANR Works
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {steps.map((step, i) => (
            <div key={step.title} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <span className="text-display text-5xl font-bold italic text-white/10">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="mt-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-yellow">
                <step.icon className="h-5 w-5 text-black" />
              </div>
              <p className="text-display mt-4 text-lg font-bold italic text-white">{step.title}</p>
              <p className="mt-1.5 text-sm text-white/50">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
