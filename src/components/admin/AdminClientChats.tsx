"use client";

import { useState } from "react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import { formatDate, formatTime } from "@/lib/utils";
import { AdminConversationView } from "@/lib/services/chat.service";

/** Admin's view-only chat oversight -- every coach this client has ever had,
 * each with full message history. Deliberately no composer and no Realtime
 * subscription: admin can see, never send (per policy), and a page refresh
 * is consistent with the rest of this audit-style page. */
export default function AdminClientChats({ conversations }: { conversations: AdminConversationView[] }) {
  const [openId, setOpenId] = useState<string | null>(conversations.find((c) => c.status === "active")?.id ?? null);

  if (conversations.length === 0) {
    return <p className="text-sm text-black/45">No chat history yet.</p>;
  }

  return (
    <div className="space-y-3">
      {conversations.map((c) => {
        const open = openId === c.id;
        return (
          <Card key={c.id} className="p-4">
            <button type="button" className="flex w-full items-center justify-between" onClick={() => setOpenId(open ? null : c.id)}>
              <span className="flex items-center gap-3">
                <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
                  <Image src={c.coach.photo} alt={c.coach.name} fill className="object-cover" />
                </span>
                <span>
                  <span className="block text-sm font-bold">{c.coach.name}</span>
                  <span className="block text-xs text-black/45">
                    {c.status === "active" ? "Current coach" : `Coach until ${c.closedAt ? formatDate(c.closedAt) : "—"}`} ·{" "}
                    {c.messages.length} message{c.messages.length === 1 ? "" : "s"}
                  </span>
                </span>
              </span>
              <span className="text-xs font-semibold text-black/40">{open ? "Hide" : "View"}</span>
            </button>

            {open && (
              <div className="mt-4 max-h-96 space-y-3 overflow-y-auto rounded-xl bg-black/[0.02] p-3">
                {c.messages.length === 0 && <p className="text-xs text-black/40">No messages in this conversation.</p>}
                {c.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.senderRole === "coach" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                        m.senderRole === "coach" ? "bg-black text-white" : "bg-black/[0.06] text-black"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.senderRole === "coach" ? "text-white/50" : "text-black/40"}`}>
                        {m.senderRole === "coach" ? "Coach" : "Client"} · {formatDate(m.createdAt)} · {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
