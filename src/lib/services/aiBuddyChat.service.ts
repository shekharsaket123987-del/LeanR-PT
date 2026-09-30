import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CONCERN_CATEGORIES } from "@/lib/constants/concern-categories";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI Relationship Manager isn't configured yet -- ask an admin to set ANTHROPIC_API_KEY.");
  return new Anthropic({ apiKey });
}

const CONCERN_CATEGORY_VALUES = CONCERN_CATEGORIES.map((c) => c.value);

const PROPOSE_CONCERN_TOOL: Anthropic.Tool = {
  name: "propose_concern",
  description:
    "Propose raising a concern with LEANR's support team on the client's behalf. This does NOT file anything automatically -- " +
    "it shows the client a confirm card so they decide. Call this instead of guessing whenever the client's request matches " +
    "one of the listed categories, or is otherwise something you cannot resolve yourself from the context you were given " +
    "(a schedule conflict you can't fix, a payment dispute, a complaint about their coach, a technical issue, wanting a coach " +
    "change, or anything else outside general motivation/encouragement/progress questions). Never call this for pain, injury, " +
    "dizziness, medication or self-harm topics -- those are caught before you ever see the message.",
  input_schema: {
    type: "object",
    properties: {
      category: { type: "string", enum: CONCERN_CATEGORY_VALUES, description: "Closest matching concern category." },
      reason: { type: "string", description: "Short (under 10 words) summary of the issue, client-facing." },
      description: { type: "string", description: "A couple of sentences of detail, written from the client's perspective." },
      level: { type: "string", enum: ["L1", "L2"], description: "L1 for a pattern to watch, L2 if a human needs to act." },
    },
    required: ["category", "reason", "description", "level"],
  },
};

const SAVE_MEMORY_NOTE_TOOL: Anthropic.Tool = {
  name: "save_memory_note",
  description:
    "Save a short fact the client just told you that isn't already in CLIENT CONTEXT and might matter later -- e.g. " +
    "'travelling 12-18 Oct', 'training for a 10K in December', 'prefers morning reminders'. Only what the client actually " +
    "said, never your own inference. Never save injury, medical or health details here -- raise a concern instead.",
  input_schema: {
    type: "object",
    properties: {
      content: { type: "string", description: "The fact, in one short sentence." },
    },
    required: ["content"],
  },
};

const PERSONA_AND_RULES = `You are LEANR's AI Relationship Manager (AI RM) -- a warm, motivating stand-in for a human relationship manager, available to a client \
right from their free demo through an active plan. You chat with the client directly, and you carry the thread across every \
conversation you've ever had with them (their recent chat history and saved memory notes are in CLIENT CONTEXT) -- you're not \
meeting them fresh each time, you're picking the relationship back up.

Tone: concise, encouraging, WhatsApp-register (short paragraphs, no corporate filler). Friendly and personally invested, like \
someone who's actually been following their journey -- not a generic customer-support voice. You are not a doctor -- for \
anything beyond general fitness/motivation advice on a medical question, encourage them to talk to their coach or raise a \
concern, never diagnose or prescribe.

Language: always reply in the same language and register the client just used. If they write in English, reply in English. \
If they write in Hindi (Devanagari script), reply in Hindi. If they write in Hinglish (Hindi in Roman letters, e.g. "han aaj \
dekhte hai"), reply in that same casual Hinglish register -- not textbook Hindi, not English. Match them turn by turn; don't \
default back to English just because earlier turns were in English.

Hard rules:
- Only state facts present in the CLIENT CONTEXT below. Never invent schedule times, payment amounts, or medical specifics.
- Never prescribe, change or judge workouts, exercises, sets, form or intensity -- that's the coach's call. Route the question \
to the coach via propose_concern instead.
- Never give diet, nutrition or supplement advice of any kind.
- If the client's request matches something you can't resolve yourself (see the propose_concern tool's description), call \
that tool instead of guessing or promising something will happen -- you have no authority to change schedules, issue \
refunds, or discipline a coach. This includes reschedule/slot-change requests: you can't move a session yourself, so offer \
to raise it the moment they mention wanting to -- don't wait for them to explicitly ask "can you raise this."
- Don't repeat information verbatim from CLIENT CONTEXT unless it's relevant to what the client just asked.
- If there's already an open concern about the same issue (listed in the context), don't propose a duplicate -- tell them \
it's already being looked at.
- If the client mentions a fact worth remembering for later (travel dates, an upcoming event, a stated preference), call \
save_memory_note. Never save injury or medical details there.
- Always write a short reply message to the client, even on a turn where you also call a tool -- e.g. "That sounds \
frustrating, I think our team should look into this directly." A tool call alone never reaches the client as a message.
- Never claim to be human, the coach, a doctor or a dietitian.`;

function systemPrompt(contextText: string): string {
  return `${PERSONA_AND_RULES}

CLIENT CONTEXT:
${contextText}`;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ConcernProposal {
  category: string;
  reason: string;
  description: string;
  level?: "L1" | "L2" | "L3";
  /** Set only for a pre-check (L3) hit or a dedupe match -- the route
   * handler has already filed/updated the escalation server-side by the
   * time this reaches the client, so the chat panel renders it as already
   * raised instead of showing "Raise this concern" / "Not now". */
  autoRaised?: boolean;
  escalationId?: string;
  triggerRule?: string;
}

export interface AIBuddyTurnResult {
  text: string;
  concernProposal: ConcernProposal | null;
  memoryNoteContent: string | null;
}

/** Runs one full model turn and returns the assembled result -- no
 * incremental token streaming to the caller. This is deliberate: the AI RM
 * PRD's post-check safety layer (aiBuddySafety.service.ts's postCheckReply(),
 * run by the route handler) must be able to inspect and, if needed, replace
 * the *complete* draft before any of it reaches the client, which isn't
 * possible if tokens are already rendering in the chat panel as they
 * arrive. Safety wins over perceived latency here. */
export async function runAIBuddyTurn(params: { contextText: string; history: ChatTurn[]; userMessage: string }): Promise<AIBuddyTurnResult> {
  const anthropic = getClient();
  const messages: Anthropic.MessageParam[] = [
    ...params.history.map((t) => ({ role: t.role, content: t.content }) as Anthropic.MessageParam),
    { role: "user", content: params.userMessage },
  ];

  const finalMessage = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt(params.contextText),
    tools: [PROPOSE_CONCERN_TOOL, SAVE_MEMORY_NOTE_TOOL],
    messages,
  });

  const textBlock = finalMessage.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  const concernUse = finalMessage.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "propose_concern");
  const memoryUse = finalMessage.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "save_memory_note");

  return {
    text: textBlock?.text ?? "",
    concernProposal: concernUse ? (concernUse.input as ConcernProposal) : null,
    memoryNoteContent: memoryUse ? (memoryUse.input as { content: string }).content : null,
  };
}

/** The once-a-day proactive opener (aiGreeting.service.ts decides *whether*
 * to greet; this decides *what to say*) -- the AI speaks first instead of
 * waiting for a question. No tools: a greeting shouldn't propose a concern
 * or save a memory note on its own initiative, only respond to what the
 * client actually says once they reply. Reuses the same CLIENT CONTEXT the
 * regular chat turn gets (attendance, recent sessions, measurement trend,
 * open concerns) so the model -- not a hardcoded template -- decides
 * whether this is a congratulate-them or gently-motivate-them morning. */
export async function generateGreeting(params: { contextText: string; timeOfDay: string }): Promise<string> {
  const anthropic = getClient();
  const instruction = `It's ${params.timeOfDay} in India and the client has just opened the chat -- there is no message from them to \
reply to. Greet them first, using CLIENT CONTEXT to make it personal: reference something real and recent (a session outcome, \
a streak, a measurement trend, an upcoming session) -- never a generic "hope you're doing well." If their recent activity \
looks strong (good attendance, logging consistently, visible progress), open on a celebratory note. If it looks like they've \
been missing sessions, skipping logging, or a measurement trend has stalled, open gently and supportively -- no guilt, just \
warmth and an easy opening question. One short greeting, 1-3 sentences, matching the persona and hard rules above.`;

  const finalMessage = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: systemPrompt(params.contextText),
    messages: [{ role: "user", content: instruction }],
  });

  const textBlock = finalMessage.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return textBlock?.text ?? "";
}
