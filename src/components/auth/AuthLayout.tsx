import Link from "next/link";
import Logo from "../shared/Logo";
import { LucideIcon } from "lucide-react";

export default function AuthLayout({
  title,
  subtitle,
  roleLabel,
  roleIcon: RoleIcon,
  children,
}: {
  title: string;
  subtitle: string;
  roleLabel: string;
  roleIcon: LucideIcon;
  imageSeed: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-brand-yellow/10 blur-[140px]" />

      <header className="container-px relative pt-8">
        <Logo height={38} />
      </header>

      <main className="container-px relative flex min-h-[calc(100vh-96px)] w-full items-center py-12">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/50 transition-colors hover:text-brand-yellow">
            <span aria-hidden>←</span> Back to Home
          </Link>

          <div className="glass-strong glow-yellow noise relative mt-5 overflow-hidden rounded-2xl p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-yellow/30 to-brand-yellow/5 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.7)]">
                <RoleIcon className="h-8 w-8 text-brand-yellow" />
              </div>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full glass-faint px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-yellow">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow shadow-[0_0_10px_2px_rgba(245,217,10,0.8)]" />
                {roleLabel}
              </div>
              <h1 className="text-display mt-3 text-2xl sm:text-3xl">{title}</h1>
              <p className="mt-1.5 text-sm text-white/60">{subtitle}</p>
            </div>

            <div className="mt-6">{children}</div>
          </div>

          <p className="mt-5 text-center text-xs text-white/25">© 2026 LEANR by Fitelo. All rights reserved.</p>
        </div>
      </main>
    </div>
  );
}
