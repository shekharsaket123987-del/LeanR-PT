import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/supabase/server-client";
import { buildAIBuddyContext } from "@/lib/services/aiBuddyContext.service";
import { insertAIBuddyMessage, insertAIAuditLog } from "@/lib/services/aiBuddyMessages.service";
import { generateGreeting } from "@/lib/services/aiBuddyChat.service";
import { postCheckReply } from "@/lib/services/aiBuddySafety.service";
import { hasGreetedToday, markGreetedToday, currentTimeOfDayIST } from "@/lib/services/aiGreeting.service";
import { isAIRMPaused } from "@/lib/services/aiKillSwitch.service";
import { getMyClientProfile } from "@/lib/services/clients.service";

export const dynamic = "force-dynamic";

/** Called once by the chat panel on mount -- decides whether the client
 * should be proactively greeted today (IST calendar day) and, if so,
 * generates and persists that greeting server-side. A no-op most of the
 * time (already greeted today); {greeted:false} is the normal steady state,
 * not an error. */
export async function POST(_request: NextRequest) {
  const token = await getAccessToken();
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  let clientId: string;
  try {
    const client = await getMyClientProfile(token);
    clientId = (client as { id: string }).id;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to resolve client" }, { status: 500 });
  }

  if (await isAIRMPaused(clientId)) return NextResponse.json({ greeted: false });
  if (await hasGreetedToday(token)) return NextResponse.json({ greeted: false });

  // Claim the slot before doing any model work -- the unique(client_id,
  // greeted_date) constraint is the real race guard (e.g. React StrictMode
  // double-mounting this effect); losing the race means someone else's
  // request is already handling today's greeting.
  const claimed = await markGreetedToday(clientId);
  if (!claimed) return NextResponse.json({ greeted: false });

  try {
    const context = await buildAIBuddyContext(token);
    const timeOfDay = currentTimeOfDayIST();
    let text = await generateGreeting({ contextText: context.contextText, timeOfDay });

    const postCheck = postCheckReply(text || "");
    if (postCheck.blocked || !text) {
      console.error("[ai-buddy/greet] greeting blocked or empty, skipping for today:", postCheck.reason);
      return NextResponse.json({ greeted: false });
    }

    const messageId = await insertAIBuddyMessage(clientId, "assistant", text);
    await insertAIAuditLog({ clientId, messageId, level: "L0", preCheckTriggered: false, postCheckBlocked: false, concernId: null });

    return NextResponse.json({
      greeted: true,
      message: { id: messageId, role: "assistant", content: text, concern_proposal: null, rating_request: false, created_at: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[ai-buddy/greet] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ greeted: false });
  }
}
