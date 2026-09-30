"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, AlertTriangle, Star } from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { formatDate, formatTime } from "@/lib/utils";
import { AIBuddyMessageRow, submitWeeklyRatingAction } from "@/lib/actions/ai-buddy.actions";
import { raiseConcernAction } from "@/lib/actions/client-concerns.actions";
import { CONCERN_CATEGORIES } from "@/lib/constants/concern-categories";
import { isFailure } from "@/lib/actions/action-result";

function categoryLabel(value: string) {
  return CONCERN_CATEGORIES.find((c) => c.value === value)?.label ?? "Other";
}

interface ConcernProposalView {
  category: string;
  reason: string;
  description: string;
  level?: "L0" | "L1" | "L2" | "L3";
  autoRaised?: boolean;
  escalationId?: string;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  concernProposal?: ConcernProposalView | null;
  concernState?: "proposed" | "raised" | "dismissed";
  ratingRequest?: boolean;
  ratingState?: "pending" | "submitted";
}

function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-white/70">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} className="p-0.5">
            <Star className={`h-4 w-4 ${n <= value ? "fill-brand-yellow text-brand-yellow" : "text-white/20"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

function WeeklyRatingCard({ onSubmitted }: { onSubmitted: (escalationRaised: boolean) => void }) {
  const [sessionRating, setSessionRating] = useState(0);
  const [coachRating, setCoachRating] = useState(0);
  const [platformRating, setPlatformRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = sessionRating > 0 && coachRating > 0 && platformRating > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    const result = await submitWeeklyRatingAction({ sessionRating, coachRating, platformRating, feedbackText: feedbackText.trim() || undefined });
    setSubmitting(false);
    if (isFailure(result)) {
      setError(result.error.message);
      return;
    }
    onSubmitted(result.data.escalationRaised);
  }

  return (
    <div className="mt-2 w-[85%] space-y-2.5 rounded-xl border border-brand-yellow/30 bg-brand-yellow/5 p-3.5">
      <StarRow label="This week's sessions" value={sessionRating} onChange={setSessionRating} />
      <StarRow label="Your PT coach" value={coachRating} onChange={setCoachRating} />
      <StarRow label="The LEANR app" value={platformRating} onChange={setPlatformRating} />
      <textarea
        value={feedbackText}
        onChange={(e) => setFeedbackText(e.target.value)}
        placeholder="Anything you'd like to add? (optional)"
        rows={2}
        className="w-full resize-none rounded-lg border border-white/15 bg-black/20 p-2 text-xs text-white placeholder:text-white/30 focus:border-brand-yellow focus:outline-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <Button size="sm" onClick={submit} disabled={!canSubmit} loading={submitting}>
        Submit feedback
      </Button>
    </div>
  );
}

/** AI Relationship Manager chat -- same message-list/composer shape as
 * ConversationThread.tsx, but a plain request/response fetch (POST + JSON)
 * instead of a Realtime subscription or token streaming: the server-side
 * post-check safety layer needs the complete draft before any of it reaches
 * the client, so there's nothing to stream (see route.ts). A reply whose
 * concern was auto-raised (pre-check L3 hit, kill-switch pause, or a
 * post-check block) renders as already-filed with no confirm buttons --
 * only a model-proposed L1/L2 concern shows the "Raise this concern" card,
 * which calls the exact same raiseConcernAction the manual "Raise a
 * Concern" flow uses. On mount, it also asks the server for today's
 * proactive greeting (POST /api/ai-buddy/greet) -- most of the time that's
 * a no-op (already greeted today), so the AI speaking first is the
 * exception call, not something this component decides on its own. */
export default function AIBuddyChatClient({ initialMessages }: { initialMessages: AIBuddyMessageRow[] }) {
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialMessages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.created_at,
      concernProposal: m.concern_proposal,
      concernState: m.concern_proposal ? ((m.concern_proposal as ConcernProposalView).autoRaised ? "raised" : "proposed") : undefined,
      ratingRequest: m.rating_request,
      ratingState: m.rating_request ? "pending" : undefined,
    }))
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const greetRequested = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.content]);

  useEffect(() => {
    if (greetRequested.current) return;
    greetRequested.current = true;
    fetch("/api/ai-buddy/greet", { method: "POST" })
      .then((res) => res.json())
      .then((payload) => {
        if (!payload?.greeted || !payload.message) return;
        const m = payload.message as AIBuddyMessageRow;
        setMessages((prev) => [
          ...prev,
          {
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.created_at,
            concernProposal: m.concern_proposal,
            ratingRequest: m.rating_request,
            ratingState: m.rating_request ? "pending" : undefined,
          },
        ]);
      })
      .catch(() => {});
  }, []);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft("");
    setError("");
    setSending(true);

    const userMsgId = `local-${Date.now()}`;
    const assistantMsgId = `local-${Date.now()}-a`;
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: body, createdAt: new Date().toISOString() },
      { id: assistantMsgId, role: "assistant", content: "", createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/ai-buddy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: body }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload) {
        throw new Error(payload?.error ?? "AI Relationship Manager couldn't respond right now.");
      }
      const proposal: ConcernProposalView | null = payload.concernProposal ?? null;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                id: payload.messageId ?? m.id,
                content: payload.text ?? "",
                concernProposal: proposal,
                concernState: proposal ? (proposal.autoRaised ? "raised" : "proposed") : undefined,
              }
            : m
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong -- try again.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    } finally {
      setSending(false);
    }
  }

  async function confirmConcern(msgId: string, proposal: ConcernProposalView) {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, concernState: "raised" } : m)));
    const level = proposal.level === "L1" || proposal.level === "L2" ? proposal.level : "L2";
    const result = await raiseConcernAction(proposal.category, proposal.reason, proposal.description, { level, aiChatMessageId: msgId });
    if (isFailure(result)) {
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, concernState: "proposed" } : m)));
      setError(result.error.message);
    }
  }

  function dismissConcern(msgId: string) {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, concernState: "dismissed" } : m)));
  }

  function handleRatingSubmitted(msgId: string, escalationRaised: boolean) {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ratingState: "submitted" } : m)));
    if (escalationRaised) {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-rating-ack-${Date.now()}`,
          role: "assistant",
          content: "Thanks for the honest feedback -- I've flagged this for the team to look into.",
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  }

  return (
    <div className="flex h-[36rem] flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-bg-elevated">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center text-white/50">
            <Sparkles className="mb-3 h-8 w-8 text-brand-yellow" />
            <p className="text-sm">Hey! I'm your AI Relationship Manager. Ask me about your progress, sessions, or plan.</p>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.role === "user";
          return (
            <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-brand-yellow text-black" : "bg-white/[0.05] text-white"}`}>
                {m.content ? (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-white/40" />
                )}
                <div className={`mt-1 text-[10px] ${mine ? "text-black/50" : "text-white/40"}`}>
                  {formatDate(m.createdAt)} · {formatTime(m.createdAt)}
                </div>
              </div>

              {m.concernProposal && m.concernState !== "dismissed" && (
                <div className="mt-2 w-[85%] rounded-xl border border-brand-yellow/30 bg-brand-yellow/5 p-3.5">
                  <div className="mb-1.5 flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-brand-yellow" />
                    <Badge variant="outline-yellow">{categoryLabel(m.concernProposal.category)}</Badge>
                  </div>
                  <p className="text-xs font-semibold text-white">{m.concernProposal.reason}</p>
                  <p className="mt-1 text-xs text-white/60">{m.concernProposal.description}</p>
                  {m.concernState === "raised" ? (
                    <p className="mt-2.5 text-xs font-semibold text-emerald-400">Raised -- check My Concerns for updates.</p>
                  ) : (
                    <div className="mt-2.5 flex gap-2">
                      <Button size="sm" onClick={() => confirmConcern(m.id, m.concernProposal!)}>
                        Raise this concern
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => dismissConcern(m.id)}>
                        Not now
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {m.ratingRequest && m.ratingState === "pending" && (
                <WeeklyRatingCard onSubmitted={(raised) => handleRatingSubmitted(m.id, raised)} />
              )}
              {m.ratingRequest && m.ratingState === "submitted" && (
                <div className="mt-2 w-[85%] rounded-xl border border-emerald-400/30 bg-emerald-400/5 p-3">
                  <p className="text-xs font-semibold text-emerald-400">Thanks for rating your week!</p>
                </div>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.06] p-3">
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
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
            placeholder="Ask your AI Relationship Manager..."
            className="max-h-32 flex-1 resize-none rounded-xl border border-white/15 p-2.5 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
          <Button size="sm" onClick={send} disabled={!draft.trim() || sending} loading={sending}>
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
