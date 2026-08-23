"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useScroll, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import Logo from "../shared/Logo";
import Button from "../ui/Button";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Coaches", href: "#coaches" },
  { label: "Pricing", href: "#pricing" },
  { label: "Success Stories", href: "#stories" },
];

export default function Navbar() {
  const { scrollYProgress } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <motion.div
        className="absolute left-0 right-0 top-0 h-[2px] origin-left bg-gradient-to-r from-brand-yellow via-brand-yellow2 to-brand-yellow"
        style={{ scaleX: scrollYProgress }}
      />
      <div className="container-px">
        <div
          className={cn(
            "mt-4 flex items-center justify-between rounded-full px-5 py-3 transition-all duration-500",
            scrolled ? "glass-strong" : "glass-faint border-transparent"
          )}
        >
          <Logo height={30} />

          <nav className="hidden items-center gap-8 lg:flex">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-medium text-white/75 transition-colors duration-300 hover:text-brand-yellow">
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <Button href="/login/coach" variant="ghost" size="sm">
              Coach Login
            </Button>
            <Button href="/login/admin" variant="ghost" size="sm">
              Admin Login
            </Button>
            <Button href="/login/client" size="sm">
              Client Login
            </Button>
          </div>

          <button aria-label="Toggle menu" className="flex flex-col gap-1.5 p-2 lg:hidden" onClick={() => setOpen((o) => !o)}>
            <span className={cn("block h-[2px] w-6 bg-white transition-transform duration-300", open && "translate-y-[7px] rotate-45")} />
            <span className={cn("block h-[2px] w-6 bg-white transition-opacity duration-300", open && "opacity-0")} />
            <span className={cn("block h-[2px] w-6 bg-white transition-transform duration-300", open && "-translate-y-[7px] -rotate-45")} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="container-px lg:hidden"
          >
            <div className="glass-strong mt-2 flex flex-col gap-5 rounded-3xl p-6">
              {LINKS.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="text-lg font-medium text-white/85 hover:text-brand-yellow">
                  {link.label}
                </Link>
              ))}
              <div className="mt-2 grid grid-cols-1 gap-2">
                <Button href="/login/client" onClick={() => setOpen(false)}>
                  Client Login
                </Button>
                <Button href="/login/coach" variant="outline" onClick={() => setOpen(false)}>
                  Coach Login
                </Button>
                <Button href="/login/admin" variant="outline" onClick={() => setOpen(false)}>
                  Admin Login
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
