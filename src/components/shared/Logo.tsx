import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/01_LeanR_by_Fitelo_logo.png";
const NATIVE_ASPECT = 400 / 376;

export default function Logo({
  href = "/",
  height = 32,
  className,
}: {
  dark?: boolean;
  href?: string;
  height?: number;
  className?: string;
}) {
  const width = Math.round(height * NATIVE_ASPECT);
  return (
    <Link href={href} className="inline-flex items-center">
      <Image
        src={LOGO_SRC}
        alt="LeanR by Fitelo"
        width={width}
        height={height}
        priority
        className={cn("mix-blend-screen select-none", className)}
        style={{ height, width: "auto" }}
      />
    </Link>
  );
}
