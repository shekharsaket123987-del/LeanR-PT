import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import BookSessionClient from "@/components/client/BookSessionClient";
import { getBookingOptionsAction } from "@/lib/actions/client-portal.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function BookSessionPage() {
  const result = await getBookingOptionsAction();

  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Book a Session" description="A few quick steps and you're on the calendar." />
        <EmptyState icon={AlertTriangle} title="Can't book right now" description={result.error.message} />
      </div>
    );
  }

  return <BookSessionClient options={result.data} />;
}
