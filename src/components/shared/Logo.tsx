import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function Logo({
  dark = true,
  href = "/",
  height = 40,
  className,
}: {
  dark?: boolean;
  size?: string;
  href?: string;
  height?: number;
  className?: string;
}) {
  const width = Math.round(height * (400 / 376));
  return (
    <Link href={href} className="inline-flex items-center">
      <Image
        src="/leanr-brand/leanr-logo.png"
        alt="LeanR by Fitelo"
        width={width}
        height={height}
        priority
        className={cn("select-none mix-blend-screen", className)}
        style={{ height, width: "auto" }}
      />
    </Link>
  );
}
