export type PortalSlug = "client" | "coach" | "admin";

function ClientPortalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <circle cx="20" cy="14" r="6" stroke="white" strokeWidth="2" />
      <path d="M8 33c0-6.6 5.4-11 12-11s12 4.4 12 11" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <path d="M13 24l3 3 3-5 3 5 3-3" stroke="#f5d90a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CoachPortalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <rect x="9" y="7" width="22" height="27" rx="2.5" stroke="white" strokeWidth="2" />
      <path d="M15 7V5.5a2 2 0 012-2h6a2 2 0 012 2V7" stroke="white" strokeWidth="2" />
      <path d="M14 17h12M14 22h12M14 27h7" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="27" cy="28" r="6" fill="#0c0c0a" stroke="#f5d90a" strokeWidth="2" />
      <path d="M24.5 28l1.8 1.8L30 26" stroke="#f5d90a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AdminPortalIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none">
      <path d="M20 4l12 5v9c0 7.4-5.1 12.6-12 15-6.9-2.4-12-7.6-12-15V9z" stroke="white" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="20" cy="17" r="3.4" stroke="#f5d90a" strokeWidth="2" />
      <path
        d="M20 20.4V24M20 13.6v-1M23.4 17H24.6M15.4 17h1.2M22.4 19.4l1 1M17.6 19.4l-1 1M22.4 14.6l1-1M17.6 14.6l-1-1"
        stroke="#f5d90a"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export type Portal = {
  slug: PortalSlug;
  label: string;
  heading: string;
  tagline: string;
  bullets: string[];
  Icon: (props: { className?: string }) => React.JSX.Element;
  from: string;
  to: string;
};

export const PORTALS: Record<PortalSlug, Portal> = {
  client: {
    slug: "client",
    label: "Client",
    heading: "Client Portal",
    tagline: "Track your plan, book sessions, and stay in sync with your coach.",
    bullets: ["View your workout & diet plan", "Book or reschedule live sessions", "Message your coach directly"],
    Icon: ClientPortalIcon,
    from: "#332f1e",
    to: "#0a0a08",
  },
  coach: {
    slug: "coach",
    label: "Coach",
    heading: "Coach Portal",
    tagline: "Manage your roster, build plans, and run live sessions.",
    bullets: ["Manage your client roster", "Build & update training plans", "Host and track live sessions"],
    Icon: CoachPortalIcon,
    from: "#2c2c1c",
    to: "#0a0a08",
  },
  admin: {
    slug: "admin",
    label: "Admin",
    heading: "Admin Portal",
    tagline: "Oversee coaches, plans, and platform operations.",
    bullets: ["Manage coaches & clients", "Configure plans & pricing", "Monitor platform activity"],
    Icon: AdminPortalIcon,
    from: "#302a1a",
    to: "#0a0a08",
  },
};

export const PORTAL_LIST = Object.values(PORTALS);
