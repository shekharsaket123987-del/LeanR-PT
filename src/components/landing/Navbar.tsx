"use client";
import { useEffect, useState } from "react";
import { motion, useScroll, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import Logo from "../shared/Logo";
import Button from "../ui/Button";
import { smoothScrollTo } from "@/lib/utils";

const LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Coaches", href: "#coaches" },
  { label: "Plans", href: "#pricing" },
  { label: "Why LeanR", href: "#why-leanr" },
  { label: "Transformations", href: "#stories" },
];

export default function Navbar() {
  const { scrollYProgress } = useScroll();
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <motion.div
        className="absolute top-0 left-0 right-0 h-[2px] origin-left bg-gradient-to-r from-yellow via-yellow-bright to-yellow"
        style={{ scaleX: scrollYProgress }}
      />
      <div className="container-px">
        <div className="mt-4 flex items-center justify-between rounded-full glass-strong px-5 py-3">
          <div
            role="button"
            tabIndex={0}
            onClick={() => smoothScrollTo("#top")}
            onKeyDown={(e) => e.key === "Enter" && smoothScrollTo("#top")}
            className="cursor-pointer"
          >
            <Logo dark />
          </div>
          <nav className="hidden items-center gap-8 lg:flex">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  e.preventDefault();
                  smoothScrollTo(link.href);
                }}
                className="text-sm font-medium text-white/75 transition-colors duration-300 hover:text-brand-yellow"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <Button href="/login/coach" variant="ghost" size="sm">
              Coach Login
            </Button>
            <Button href="/login/admin" variant="ghost" size="sm">
              Admin Login
            </Button>
            <Button href="/login/client" variant="primary" size="sm">
              Client Login
            </Button>
          </div>
          <button aria-label="Toggle menu" className="p-2 text-white lg:hidden" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
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
            <div className="mt-2 flex flex-col gap-5 rounded-3xl glass-strong p-6">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    smoothScrollTo(link.href);
                  }}
                  className="text-lg font-medium text-white/85 hover:text-brand-yellow"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 grid grid-cols-1 gap-2">
                <Button href="/login/client" variant="primary">
                  Client Login
                </Button>
                <Button href="/login/coach" variant="outline">
                  Coach Login
                </Button>
                <Button href="/login/admin" variant="outline">
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
