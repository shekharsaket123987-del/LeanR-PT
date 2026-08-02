"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarPlus,
  UserRound,
  TrendingUp,
  Bell,
  User,
  Users,
  ClipboardList,
  Clock,
  BarChart3,
  Settings,
  UserCog,
  RefreshCw,
  FileText,
  Menu,
  X,
  LogOut,
  ChevronDown,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import Badge from "../ui/Badge";

type Role = "client" | "coach" | "admin";

const NAV: Record<Role, { label: string; href: string; icon: any }[]> = {
  client: [
    { label: "Dashboard", href: "/client/dashboard", icon: LayoutDashboard },
    { label: "My Sessions", href: "/client/sessions", icon: CalendarDays },
    { label: "Book a Session", href: "/client/book", icon: CalendarPlus },
    { label: "My Coach", href: "/client/coach", icon: UserRound },
    { label: "Progress", href: "/client/progress", icon: TrendingUp },
    { label: "Notifications", href: "/client/notifications", icon: Bell },
    { label: "Profile", href: "/client/profile", icon: User },
  ],
  coach: [
    { label: "Dashboard", href: "/coach/dashboard", icon: LayoutDashboard },
    { label: "Schedule", href: "/coach/schedule", icon: CalendarDays },
    { label: "Clients", href: "/coach/clients", icon: Users },
    { label: "Availability", href: "/coach/availability", icon: Clock },
    { label: "Profile", href: "/coach/profile", icon: User },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Clients", href: "/admin/clients", icon: Users },
    { label: "Coaches", href: "/admin/coaches", icon: UserCog },
    { label: "Sessions", href: "/admin/sessions", icon: CalendarDays },
    { label: "Coach Change Requests", href: "/admin/coach-change-requests", icon: RefreshCw },
    { label: "Reports", href: "/admin/reports", icon: FileText },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
};

const IDENTITY: Record<Role, { name: string; photo: string; sub: string }> = {
  client: { name: "Saket Shekhar", photo: "https://i.pravatar.cc/300?img=68", sub: "LeanR Advance" },
  coach: { name: "Arjun Mehta", photo: "https://i.pravatar.cc/300?img=12", sub: "Strength & Conditioning" },
  admin: { name: "Admin", photo: "https://i.pravatar.cc/300?img=5", sub: "Operations Team" },
};

export default function PortalShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav = NAV[role];
  const identity = IDENTITY[role];

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-black/[0.06] bg-white px-4 py-3 lg:hidden">
        <Link href="/" className="flex items-center gap-1">
          <span className="text-display text-xl font-bold italic tracking-tight">
            LEAN<span className="text-brand-yellow" style={{ WebkitTextStroke: "1px black" }}>R</span>
          </span>
        </Link>
        <button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-black/5">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-black/[0.06] bg-white transition-transform duration-200 lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:translate-x-0 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between px-6 py-6">
              <Link href="/" className="flex items-center gap-1.5">
                <span className="text-display text-2xl font-bold italic tracking-tight text-black">
                  LEANR
                </span>
                <span className="h-1.5 w-1.5 rounded-full bg-brand-yellow" />
              </Link>
              <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 hover:bg-black/5 lg:hidden">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-4">
              <Badge variant="black" className="mb-4 ml-2">
                {role} Portal
              </Badge>
            </div>

            <nav className="flex-1 space-y-1 px-4">
              {nav.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                      active ? "bg-black text-white" : "text-black/60 hover:bg-black/5 hover:text-black"
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 ${active ? "text-brand-yellow" : ""}`} style={{ height: 18, width: 18 }} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-black/[0.06] p-4">
              <div className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar src={identity.photo} alt={identity.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{identity.name}</p>
                  <p className="truncate text-xs text-black/45">{identity.sub}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-black/50 hover:bg-black/5 hover:text-red-600"
              >
                <LogOut style={{ height: 18, width: 18 }} />
                Log out
              </button>
            </div>
          </div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMobileOpen(false)} />
        )}

        {/* Main content */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
