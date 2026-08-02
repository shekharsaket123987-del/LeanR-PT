"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import Logo from "../shared/Logo";
import Button from "../ui/Button";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
        <Logo dark />
        <nav className="hidden items-center gap-8 lg:flex">
          <Link href="#how-it-works" className="text-sm font-semibold text-white/70 hover:text-white">
            How it Works
          </Link>
          <Link href="#coaches" className="text-sm font-semibold text-white/70 hover:text-white">
            Coaches
          </Link>
          <Link href="#pricing" className="text-sm font-semibold text-white/70 hover:text-white">
            Pricing
          </Link>
          <Link href="#stories" className="text-sm font-semibold text-white/70 hover:text-white">
            Success Stories
          </Link>
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Button href="/login/coach" variant="ghost" size="sm" className="text-white hover:bg-white/10">
            Coach Login
          </Button>
          <Button href="/login/admin" variant="ghost" size="sm" className="text-white hover:bg-white/10">
            Admin Login
          </Button>
          <Button href="/login/client" variant="primary" size="sm">
            Client Login
          </Button>
        </div>
        <button className="p-2 text-white lg:hidden" onClick={() => setOpen(!open)}>
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-white/10 bg-black px-5 py-5 lg:hidden">
          <div className="flex flex-col gap-4">
            <Link href="#how-it-works" onClick={() => setOpen(false)} className="text-sm font-semibold text-white/70">
              How it Works
            </Link>
            <Link href="#pricing" onClick={() => setOpen(false)} className="text-sm font-semibold text-white/70">
              Pricing
            </Link>
            <Link href="#stories" onClick={() => setOpen(false)} className="text-sm font-semibold text-white/70">
              Success Stories
            </Link>
            <div className="mt-2 grid grid-cols-1 gap-2">
              <Button href="/login/client" variant="primary">
                Client Login
              </Button>
              <Button href="/login/coach" variant="outline" className="border-white/20 text-white">
                Coach Login
              </Button>
              <Button href="/login/admin" variant="outline" className="border-white/20 text-white">
                Admin Login
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
