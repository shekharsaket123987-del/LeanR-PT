"use client";

import { useState } from "react";
import Image from "next/image";
import { MessagesSquare } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import ConversationThread from "@/components/chat/ConversationThread";
import { CoachConversationView, ConversationCategory } from "@/lib/services/chat.service";

type Tab = ConversationCategory;
const TABS: { key: Tab; label: string }[] = [
  { key: "active", label: "Active Client Chat" },
  { key: "old", label: "Old Client Chat" },
  { key: "expired", label: "Expired Client Chat" },
  { key: "pause", label: "Pause Client Chat" },
];

export default function CoachChatsClient({ conversations }: { conversations: CoachConversationView[] }) {
  const [tab, setTab] = useState<Tab>("active");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => conversations.find((c) => c.category === "active")?.id ?? null
  );

  function selectTab(next: Tab) {
    setTab(next);
    setSelectedId(conversations.find((c) => c.category === next)?.id ?? null);
  }

  const filtered = conversations.filter((c) => c.category === tab);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="My Chats" description="Conversations with your clients." />

      <div className="mb-6 flex flex-wrap gap-1 rounded-xl bg-black/5 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => selectTab(t.key)}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:text-sm ${
              tab === t.key ? "bg-white shadow-card" : "text-black/50 hover:text-black"
            }`}
          >
            {t.label} ({conversations.filter((c) => c.category === t.key).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="Nothing here" description="No conversations in this filter yet." />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            {filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${
                  selectedId === c.id ? "border-brand-yellow bg-brand-yellow/10" : "border-black/10 hover:border-black/25"
                }`}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <Image src={c.client.photo} alt={c.client.name} fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    Client {c.client.name}
                    {c.client.clientCode ? ` · ${c.client.clientCode}` : ""}
                  </p>
                  <p className="text-xs text-black/45">{c.status === "closed" ? "Closed" : "Active"}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-2">
            {selected && (
              <ConversationThread
                key={selected.id}
                conversationId={selected.id}
                myRole="coach"
                readOnly={selected.status === "closed"}
                readOnlyReason="A new coach has been assigned to this client — you can still see this history, but can't send new messages."
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
