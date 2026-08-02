import PortalShell from "@/components/shared/PortalShell";

export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell role="client">{children}</PortalShell>;
}
