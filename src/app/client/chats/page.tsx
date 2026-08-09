import { AlertTriangle } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ClientChatsClient from "@/components/client/ClientChatsClient";
import { getMyChatsAsClientAction } from "@/lib/actions/chat.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function ClientChatsPage() {
  const result = await getMyChatsAsClientAction();
  if (isFailure(result)) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="My Chats" description="Message your coach directly." />
        <EmptyState icon={AlertTriangle} title="Can't load chats right now" description={result.error.message} />
      </div>
    );
  }
  return <ClientChatsClient conversations={result.data} />;
}
