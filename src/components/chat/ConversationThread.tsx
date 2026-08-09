"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCheck, ImagePlus, Loader2, Send, Smile } from "lucide-react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import { formatDate, formatTime } from "@/lib/utils";
import {
  MessageView,
  getConversationMessagesAction,
  markConversationReadAction,
  sendChatMessageAction,
} from "@/lib/actions/chat.actions";
import { isFailure } from "@/lib/actions/action-result";

const EMOJIS = [
  "😀", "😂", "😍", "🙂", "😉", "😊", "😢", "😮", "😅", "🤔",
  "👍", "👎", "🙏", "👏", "🙌", "💪", "🤝", "👌", "✌️", "🤗",
  "❤️", "🔥", "🎉", "🥳", "💯", "⭐", "✅", "❌", "⏰", "📸",
];

/** Shared message list + composer for both the client and coach "My Chats"
 * screens. Loads history via a server action, then subscribes to Realtime
 * for live delivery -- RLS (migration 0042) gates the subscription exactly
 * like a normal read, so a coach who's since been replaced simply never
 * receives anything for a conversation they're no longer part of. Sending
 * also goes through a server action (so the DB's closed-conversation check
 * actually applies); the sender appends optimistically and the realtime
 * echo of their own message is deduped by id. A second subscription on
 * UPDATE catches read-receipt changes (migration 0044) so a sent message's
 * tick flips live the moment the other side reads it. */
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
  const [showEmoji, setShowEmoji] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toMessageView(row: any): MessageView {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      senderRole: row.sender_role,
      senderProfileId: row.sender_profile_id,
      body: row.body ?? "",
      attachmentUrl: row.attachment_url ?? null,
      readAt: row.read_at ?? null,
      createdAt: row.created_at,
    };
  }

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
      markConversationReadAction(conversationId);
    });

    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = toMessageView(payload.new);
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
          if (incoming.senderRole !== myRole) markConversationReadAction(conversationId);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const updated = toMessageView(payload.new);
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [conversationId, myRole]);

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

  async function sendImage(file: File) {
    setSending(true);
    setSendError("");
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("chat-attachments").upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from("chat-attachments").getPublicUrl(path);

      const result = await sendChatMessageAction(conversationId, draft.trim(), pub.publicUrl);
      if (isFailure(result)) {
        setSendError(result.error.message);
        return;
      }
      setMessages((prev) => (prev.some((m) => m.id === result.data.id) ? prev : [...prev, result.data]));
      setDraft("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send image");
    } finally {
      setSending(false);
    }
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
                  {m.attachmentUrl && (
                    <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- external, dynamically-uploaded URL */}
                      <img src={m.attachmentUrl} alt="Attachment" className="mb-1.5 max-h-64 w-full rounded-lg object-cover" />
                    </a>
                  )}
                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  <div className={`mt-1 flex items-center gap-1 text-[10px] ${mine ? "text-white/50" : "text-black/40"}`}>
                    <span>
                      {formatDate(m.createdAt)} · {formatTime(m.createdAt)}
                    </span>
                    {mine &&
                      (m.readAt ? (
                        <CheckCheck className="h-3 w-3 text-sky-400" />
                      ) : (
                        <Check className="h-3 w-3" />
                      ))}
                  </div>
                </div>
              </div>
            );
          })}
        <div ref={bottomRef} />
      </div>

      {!readOnly && (
        <div className="relative border-t border-black/[0.06] p-3">
          {sendError && <p className="mb-2 text-xs text-red-600">{sendError}</p>}
          {showEmoji && (
            <div className="absolute bottom-full left-3 mb-2 grid grid-cols-10 gap-1 rounded-xl border border-black/10 bg-white p-2 shadow-2xl">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => {
                    setDraft((d) => d + e);
                    setShowEmoji(false);
                  }}
                  className="rounded-lg p-1 text-lg hover:bg-black/5"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) sendImage(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="rounded-xl p-2.5 text-black/50 hover:bg-black/5 disabled:opacity-50"
              title="Send an image"
            >
              <ImagePlus className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
            </button>
            <button
              type="button"
              onClick={() => setShowEmoji((s) => !s)}
              className="rounded-xl p-2.5 text-black/50 hover:bg-black/5"
              title="Emoji"
            >
              <Smile className="h-4.5 w-4.5" style={{ height: 18, width: 18 }} />
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={() => setShowEmoji(false)}
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
            <Button size="sm" onClick={send} disabled={!draft.trim() || sending} loading={sending}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
