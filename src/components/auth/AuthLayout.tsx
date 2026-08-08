import Image from "next/image";
import Logo from "../shared/Logo";
import { LucideIcon } from "lucide-react";

export default function AuthLayout({
  title,
  subtitle,
  roleLabel,
  roleIcon: RoleIcon,
  imageSeed,
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
    <div className="grid min-h-screen grid-cols-1 bg-black lg:grid-cols-2">
      <div className="flex flex-col justify-between px-6 py-8 sm:px-12 sm:py-10">
        <Logo dark />

        <div className="mx-auto w-full max-w-sm py-16">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-brand-yellow/30 bg-brand-yellow/10 px-3 py-1.5">
            <RoleIcon className="h-3.5 w-3.5 text-brand-yellow" />
            <span className="text-xs font-bold uppercase tracking-wide text-brand-yellow">{roleLabel}</span>
          </div>
          <h1 className="text-display text-4xl font-bold italic leading-tight text-white">{title}</h1>
          <p className="mt-3 text-sm text-white/50">{subtitle}</p>
          <div className="mt-10">{children}</div>
        </div>

        <p className="text-xs text-white/25">© 2026 LEANR by Fitelo. All rights reserved.</p>
      </div>

      <div className="relative hidden lg:block">
        <Image src={`https://picsum.photos/seed/${imageSeed}/1200/1400`} alt="" fill className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-l from-black/20 via-black/50 to-black" />
        <div className="absolute bottom-12 left-12 right-12 rounded-2xl border border-white/10 bg-black/50 p-6 backdrop-blur-md">
          <p className="text-display text-xl italic text-white">&ldquo;LEANR made showing up the easy part.&rdquo;</p>
          <p className="mt-2 text-xs font-medium text-white/50">Ishita Rao · Client since 2025</p>
        </div>
      </div>
    </div>
  );
}
