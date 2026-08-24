import Link from "next/link";
import Logo from "../shared/Logo";
import { Instagram, Youtube, Facebook } from "lucide-react";
import FlipSection from "../ui/FlipSection";
import GlassSectionPanel from "../ui/GlassSectionPanel";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 pb-8 pt-16 text-white sm:pt-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-yellow/40 to-transparent" />
      <div className="pointer-events-none absolute -left-32 top-0 h-72 w-72 rounded-full bg-brand-yellow/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-32 top-40 h-72 w-72 rounded-full bg-brand-yellow/5 blur-[120px]" />

      <FlipSection className="container-px">
        <GlassSectionPanel className="p-6 noise sm:p-9">
          <div className="mx-auto max-w-7xl">
            <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Logo dark />
                <p className="mt-4 max-w-xs text-sm text-white/40">
                  Live online personal training, built by Fitelo. Real coaches, real results, anywhere.
                </p>
                <div className="mt-5 flex gap-3">
                  {[Instagram, Youtube, Facebook].map((Icon, i) => (
                    <div key={i} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
                      <Icon className="h-4 w-4" />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">Portals</p>
                <div className="mt-4 flex flex-col gap-3 text-sm">
                  <Link href="/login/client" className="text-white/70 hover:text-brand-yellow">Client Login</Link>
                  <Link href="/login/coach" className="text-white/70 hover:text-brand-yellow">Coach Login</Link>
                  <Link href="/login/admin" className="text-white/70 hover:text-brand-yellow">Admin Login</Link>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">Company</p>
                <div className="mt-4 flex flex-col gap-3 text-sm">
                  <Link href="#how-it-works" className="text-white/70 hover:text-brand-yellow">How it Works</Link>
                  <Link href="#pricing" className="text-white/70 hover:text-brand-yellow">Pricing</Link>
                  <Link href="#coaches" className="text-white/70 hover:text-brand-yellow">Our Coaches</Link>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/40">Get in Touch</p>
                <div className="mt-4 flex flex-col gap-3 text-sm text-white/70">
                  <p>support@leanr.fitelo.co</p>
                  <p>+91 1800 123 4567</p>
                </div>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/30 sm:flex-row">
              <p>© 2026 LEANR by Fitelo. All rights reserved.</p>
              <div className="flex gap-6">
                <Link href="#" className="hover:text-white/60">Privacy Policy</Link>
                <Link href="#" className="hover:text-white/60">Terms of Service</Link>
              </div>
            </div>
          </div>
        </GlassSectionPanel>
      </FlipSection>
    </footer>
  );
}
