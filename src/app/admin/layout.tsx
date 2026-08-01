import PortalShell from "@/components/shared/PortalShell";

export default function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell role="admin">{children}</PortalShell>;
}
