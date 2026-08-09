import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import CoachChatsClient from "@/components/coach/CoachChatsClient";
import { getMyChatsAsCoachAction } from "@/lib/actions/chat.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function CoachChatsPage() {
  const result = await getMyChatsAsCoachAction();
  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-5xl">
        <PageHeader title="My Chats" description="Conversations with your clients." />
        <EmptyState icon={AlertTriangle} title="Can't load chats right now" description={result.error.message} />
      </div>
    );
  }
  return <CoachChatsClient conversations={result.data} />;
}
