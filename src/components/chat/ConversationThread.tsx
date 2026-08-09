"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { formatDate, formatTime } from "@/lib/utils";
import { MessageView, getConversationMessagesAction, sendChatMessageAction } from "@/lib/actions/chat.actions";
import { isFailure } from "@/lib/actions/action-result";

/** Shared message list + composer for both the client and coach "My Chats"
 * screens. Loads history via a server action, then subscribes to Realtime
 * for live delivery -- RLS (migration 0042) gates the subscription exactly
 * like a normal read, so a coach who's since been replaced simply never
 * receives anything for a conversation they're no longer part of. Sending
 * also goes through a server action (so the DB's closed-conversation check
 * actually applies); the sender appends optimistically and the realtime
 * echo of their own message is deduped by id. */
export default function ConversationThread({
  conversationId,
  myRole,
  readOnly,
  readOnlyReason,
}: {
  conversationId: string;
  myRole: "client" | "coach";
  readOnly: boolean;
  readOnlyReason?: string;
}) {
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    setMessages([]);

    getConversationMessagesAction(conversationId).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (isFailure(result)) {
        setLoadError(result.error.message);
        return;
      }
      setMessages(result.data);
    });

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as any;
          const incoming: MessageView = {
            id: row.id,
            conversationId: row.conversation_id,
            senderRole: row.sender_role,
            senderProfileId: row.sender_profile_id,
            body: row.body,
            createdAt: row.created_at,
          };
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setSendError("");
    const result = await sendChatMessageAction(conversationId, body);
    setSending(false);
    if (isFailure(result)) {
      setSendError(result.error.message);
      return;
    }
    setMessages((prev) => (prev.some((m) => m.id === result.data.id) ? prev : [...prev, result.data]));
    setDraft("");
  }

  return (
    <div className="flex h-[32rem] flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white">
      {readOnly && (
        <div className="border-b border-black/[0.06] bg-black/[0.03] px-4 py-2.5 text-xs font-semibold text-black/50">
          {readOnlyReason ?? "This conversation is closed — you can still see the history, but can't send new messages."}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-black/40" />
          </div>
        )}
        {!loading && loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {!loading && !loadError && messages.length === 0 && <p className="text-sm text-black/40">No messages yet.</p>}
        {!loading &&
          messages.map((m) => {
            const mine = m.senderRole === myRole;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-black text-white" : "bg-black/[0.05] text-black"}`}>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/50" : "text-black/40"}`}>
                    {formatDate(m.createdAt)} · {formatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        <div ref={bottomRef} />
      </div>

      {!readOnly && (
        <div className="border-t border-black/[0.06] p-3">
          {sendError && <p className="mb-2 text-xs text-red-600">{sendError}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              rows={1}
              placeholder="Type a message..."
              className="max-h-32 flex-1 resize-none rounded-xl border border-black/15 p-2.5 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
            />
            <Button size="sm" onClick={send} disabled={!draft.trim()} loading={sending}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
