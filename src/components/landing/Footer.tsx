"use client";

import Link from "next/link";
import Logo from "../shared/Logo";
import FlipSection from "../ui/FlipSection";
import GlassSectionPanel from "../ui/GlassSectionPanel";
import Reveal from "../ui/Reveal";
import { Instagram, Youtube, Facebook } from "lucide-react";
import { smoothScrollTo } from "@/lib/utils";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden pb-8 pt-16 sm:pt-20">
      <FlipSection className="container-px">
        <GlassSectionPanel className="p-6 noise sm:p-9">
          <Reveal className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo dark />
              <p className="mt-4 max-w-xs text-sm text-white/40">
                Live online personal training, built by Fitelo. Real coaches, real results, anywhere.
              </p>
              <div className="mt-5 flex gap-3">
                {[Instagram, Youtube, Facebook].map((Icon, i) => (
                  <div key={i} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20">
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
                <a href="#how-it-works" onClick={(e) => { e.preventDefault(); smoothScrollTo("#how-it-works"); }} className="cursor-pointer text-white/70 hover:text-brand-yellow">
                  How It Works
                </a>
                <a href="#pricing" onClick={(e) => { e.preventDefault(); smoothScrollTo("#pricing"); }} className="cursor-pointer text-white/70 hover:text-brand-yellow">
                  Plans
                </a>
                <a href="#coaches" onClick={(e) => { e.preventDefault(); smoothScrollTo("#coaches"); }} className="cursor-pointer text-white/70 hover:text-brand-yellow">
                  Our Coaches
                </a>
                <a href="#stories" onClick={(e) => { e.preventDefault(); smoothScrollTo("#stories"); }} className="cursor-pointer text-white/70 hover:text-brand-yellow">
                  Transformations
                </a>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/40">Get in Touch</p>
              <div className="mt-4 flex flex-col gap-3 text-sm text-white/70">
                <p>support@leanr.fitelo.co</p>
                <p>+91 1800 123 4567</p>
              </div>
            </div>
          </Reveal>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-xs text-white/30 sm:flex-row">
            <p>© 2026 LEANR by Fitelo. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="#" className="hover:text-white/60">Privacy Policy</Link>
              <Link href="#" className="hover:text-white/60">Terms of Service</Link>
            </div>
          </div>
        </GlassSectionPanel>
      </FlipSection>
    </footer>
  );
}
