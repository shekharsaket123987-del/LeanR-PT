"use client";

import { useState } from "react";
import Image from "next/image";
import { MessagesSquare } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ConversationThread from "@/components/chat/ConversationThread";
import { ClientConversationView } from "@/lib/services/chat.service";

export default function ClientChatsClient({ conversations }: { conversations: ClientConversationView[] }) {
  const active = conversations.find((c) => c.status === "active") ?? null;
  const past = conversations.filter((c) => c.status === "closed");
  const [openPastId, setOpenPastId] = useState<string | null>(null);

  if (conversations.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title="My Chats" description="Message your coach directly." />
        <EmptyState
          icon={MessagesSquare}
          title="No conversations yet"
          description="A chat opens automatically once you've purchased a plan and a coach is assigned."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader title="My Chats" description="Message your coach directly." />

      {active ? (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full">
              <Image src={active.coach.photo} alt={active.coach.name} fill className="object-cover" />
            </div>
            <p className="text-sm font-bold">{active.coach.name}</p>
          </div>
          <ConversationThread conversationId={active.id} myRole="client" readOnly={false} />
        </div>
      ) : (
        <EmptyState icon={MessagesSquare} title="No active chat" description="You'll get a new chat once a coach is assigned." />
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-display mb-3 text-lg font-bold italic">Past Coaches</h2>
          <div className="space-y-2">
            {past.map((c) => {
              const open = openPastId === c.id;
              return (
                <Card key={c.id} className="p-4">
                  <button type="button" className="flex w-full items-center justify-between" onClick={() => setOpenPastId(open ? null : c.id)}>
                    <span className="flex items-center gap-3">
                      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
                        <Image src={c.coach.photo} alt={c.coach.name} fill className="object-cover" />
                      </span>
                      <span className="text-sm font-bold">{c.coach.name}</span>
                      {c.unreadCount > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-400/100 px-1.5 text-[11px] font-bold text-white">
                          {c.unreadCount}
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-semibold text-white/40">{open ? "Hide" : "View"}</span>
                  </button>
                  {open && (
                    <div className="mt-4">
                      <ConversationThread
                        conversationId={c.id}
                        myRole="client"
                        readOnly
                        readOnlyReason="This coach is no longer assigned to you — you can still see this history."
                      />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
