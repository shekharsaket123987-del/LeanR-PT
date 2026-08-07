import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import AvailabilityCheckClient from "@/components/admin/AvailabilityCheckClient";
import AvailabilityDateNav from "@/components/admin/AvailabilityDateNav";
import { getAvailabilityCheckAction } from "@/lib/actions/admin-availability.actions";
import { isFailure } from "@/lib/actions/action-result";

function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export default async function AvailabilityCheckPage({ searchParams }: { searchParams: { date?: string } }) {
  const date = searchParams.date || todayIST();
  const result = await getAvailabilityCheckAction(date);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Availability Check" description="Every coach's slots for the day, booked or free, in chronological order." />
      <AvailabilityDateNav date={date} />
      {isFailure(result) ? (
        <EmptyState icon={AlertTriangle} title="Couldn't load availability" description={result.error.message} />
      ) : (
        <AvailabilityCheckClient slots={result.data} />
      )}
    </div>
  );
}
