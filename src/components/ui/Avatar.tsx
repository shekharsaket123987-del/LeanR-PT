import Image from "next/image";
import { cn } from "@/lib/utils";

export default function Avatar({
  src,
  alt,
  size = 40,
  className,
  ring,
}: {
  src: string;
  alt: string;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full bg-white/10",
        ring && "ring-2 ring-brand-yellow ring-offset-2 ring-offset-surface",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Image src={src} alt={alt} fill sizes={`${size}px`} className="object-cover" />
    </div>
  );
}
