import PortalShell from "@/components/shared/PortalShell";

export default function CoachPortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell role="coach">{children}</PortalShell>;
}
