import Link from "next/link";
import Logo from "../shared/Logo";
import { Instagram, Youtube, Facebook } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-black py-16 text-white">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
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
    </footer>
  );
}
