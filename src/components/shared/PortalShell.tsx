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
  AlertTriangle,
  History,
  ShieldAlert,
  Search,
  Receipt,
  CalendarSearch,
  MessagesSquare,
  RefreshCcw,
} from "lucide-react";
import Avatar from "../ui/Avatar";
import Badge from "../ui/Badge";

type Role = "client" | "coach" | "admin";

const NAV: Record<Role, { label: string; href: string; icon: any }[]> = {
  client: [
    { label: "Dashboard", href: "/client/dashboard", icon: LayoutDashboard },
    { label: "My Sessions", href: "/client/sessions", icon: CalendarDays },
    { label: "Book a Session", href: "/client/book", icon: CalendarPlus },
    { label: "My Schedule", href: "/client/schedule", icon: Clock },
    { label: "My Chats", href: "/client/chats", icon: MessagesSquare },
    { label: "My Coach", href: "/client/coach", icon: UserRound },
    { label: "Subscription", href: "/client/subscription", icon: Receipt },
    { label: "Progress", href: "/client/progress", icon: TrendingUp },
    { label: "My Concerns", href: "/client/concerns", icon: AlertTriangle },
    { label: "Notifications", href: "/client/notifications", icon: Bell },
    { label: "Profile", href: "/client/profile", icon: User },
  ],
  coach: [
    { label: "Dashboard", href: "/coach/dashboard", icon: LayoutDashboard },
    { label: "Schedule", href: "/coach/schedule", icon: CalendarDays },
    { label: "Clients", href: "/coach/clients", icon: Users },
    { label: "Renewal Opportunities", href: "/coach/renewals", icon: RefreshCcw },
    { label: "My Chats", href: "/coach/chats", icon: MessagesSquare },
    { label: "Search", href: "/coach/search", icon: Search },
    { label: "Escalations", href: "/coach/escalations", icon: AlertTriangle },
    { label: "Performance", href: "/coach/performance", icon: BarChart3 },
    { label: "Availability", href: "/coach/availability", icon: Clock },
    { label: "Notifications", href: "/coach/notifications", icon: Bell },
    { label: "Profile", href: "/coach/profile", icon: User },
  ],
  admin: [
    { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Search", href: "/admin/search", icon: Search },
    { label: "Clients", href: "/admin/clients", icon: Users },
    { label: "Renewal Opportunities", href: "/admin/renewals", icon: RefreshCcw },
    { label: "Coaches", href: "/admin/coaches", icon: UserCog },
    { label: "Sessions", href: "/admin/sessions", icon: CalendarDays },
    { label: "Sales", href: "/admin/sales", icon: Receipt },
    { label: "Scheduling", href: "/admin/scheduling", icon: ClipboardList },
    { label: "Availability Check", href: "/admin/availability", icon: CalendarSearch },
    { label: "Coach Change Requests", href: "/admin/coach-change-requests", icon: RefreshCw },
    { label: "Leave Requests", href: "/admin/leave-requests", icon: Clock },
    { label: "Shadow Coverage", href: "/admin/shadow-coverage", icon: ShieldAlert },
    { label: "Escalations", href: "/admin/escalations", icon: AlertTriangle },
    { label: "Notifications", href: "/admin/notifications", icon: Bell },
    { label: "Activity Log", href: "/admin/activity-log", icon: History },
    { label: "Reports", href: "/admin/reports", icon: FileText },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ],
};

const IDENTITY_FALLBACK: Record<Role, { name: string; photo: string; sub: string }> = {
  client: { name: "Client", photo: "https://i.pravatar.cc/300?img=68", sub: "" },
  coach: { name: "Coach", photo: "https://i.pravatar.cc/300?img=12", sub: "" },
  admin: { name: "Admin", photo: "https://i.pravatar.cc/300?img=5", sub: "Operations Team" },
};

export default function PortalShell({
  role,
  identity,
  children,
  hideBookSessionNav,
  showChatNav,
  chatUnreadCount,
}: {
  role: Role;
  identity?: { name: string; photo: string; sub: string };
  children: React.ReactNode;
  /** Once a client has an active plan, the recurring schedule (My Schedule)
   * is their only ongoing booking mechanism -- the ad-hoc "Book a Session"
   * wizard becomes a redundant, easy-to-confuse-with-it second path. */
  hideBookSessionNav?: boolean;
  /** Chat only exists once a client has paid and a coach is assigned -- a
   * brand-new lead/demo-only client has no conversation to show, so the nav
   * item stays hidden until one has actually been opened. Coaches always see
   * theirs (no gating needed -- an empty inbox is a normal state for them). */
  showChatNav?: boolean;
  /** Total unread messages across all of this user's conversations -- shown
   * as a small badge on "My Chats." Only refreshes on navigation/server
   * round-trips, not live. */
  chatUnreadCount?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const nav =
    role === "client"
      ? NAV.client.filter((item) => {
          if (item.href === "/client/book" && hideBookSessionNav) return false;
          if (item.href === "/client/chats" && !showChatNav) return false;
          return true;
        })
      : NAV[role];
  const resolvedIdentity = identity ?? IDENTITY_FALLBACK[role];

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

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4">
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
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/client/chats" || item.href === "/coach/chats" ? (
                      chatUnreadCount ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                          {chatUnreadCount}
                        </span>
                      ) : null
                    ) : null}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-black/[0.06] p-4">
              <div className="flex items-center gap-3 rounded-xl px-2 py-2">
                <Avatar src={resolvedIdentity.photo} alt={resolvedIdentity.name} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{resolvedIdentity.name}</p>
                  <p className="truncate text-xs text-black/45">{resolvedIdentity.sub}</p>
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
