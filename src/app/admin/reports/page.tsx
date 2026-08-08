import PageHeader from "@/components/shared/PageHeader";
import AdminReportsClient from "@/components/admin/AdminReportsClient";

export default function ReportsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Reports" description="Export data for finance, ops, and coaching reviews." />
      <AdminReportsClient />
    </div>
  );
}
