import { Sparkles } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import AIBuddyChatClient from "@/components/client/AIBuddyChatClient";
import { getAIBuddyHistoryAction } from "@/lib/actions/ai-buddy.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function AIRelationshipManagerPage() {
  const result = await getAIBuddyHistoryAction();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="AI Relationship Manager"
        description="Your always-on check-in -- ask about your progress, sessions, or plan. If something needs a human, I'll say so."
      />
      {isFailure(result) ? (
        <EmptyState icon={Sparkles} title="Couldn't load your AI Relationship Manager" description={result.error.message} />
      ) : (
        <AIBuddyChatClient initialMessages={result.data} />
      )}
    </div>
  );
}
