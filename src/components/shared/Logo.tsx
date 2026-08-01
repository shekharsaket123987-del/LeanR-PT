import Link from "next/link";

export default function Logo({ dark = true, href = "/" }: { dark?: boolean; size?: string; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2">
      <span
        className={`text-display text-2xl font-bold italic tracking-tight sm:text-3xl ${
          dark ? "text-brand-yellow" : "text-black"
        }`}
      >
        LEANR
      </span>
      <span className="flex flex-col leading-none">
        <span className={`font-script text-[11px] italic ${dark ? "text-white/80" : "text-black/60"}`}>By</span>
        <span className={`text-[11px] font-bold tracking-wide ${dark ? "text-white" : "text-black"}`}>FITELO</span>
      </span>
    </Link>
  );
}
