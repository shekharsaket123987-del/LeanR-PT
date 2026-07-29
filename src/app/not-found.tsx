import Link from "next/link";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
      <span className="text-display text-7xl font-bold italic text-brand-yellow">404</span>
      <p className="text-display mt-4 text-2xl font-bold italic text-white">Lost your rep count?</p>
      <p className="mt-2 max-w-sm text-sm text-white/50">The page you're looking for doesn't exist. Let's get you back on track.</p>
      <Button href="/" className="mt-7">
        Back to Home
      </Button>
    </div>
  );
}
