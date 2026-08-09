"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import {
  AdminConversationView,
  ClientConversationView,
  CoachConversationView,
  MessageView,
  clientHasAnyConversation,
  listAllConversationsForClient,
  listMessages,
  listMyConversationsAsClient,
  listMyConversationsAsCoach,
  sendMessage,
} from "@/lib/services/chat.service";

export type { AdminConversationView, ClientConversationView, CoachConversationView, MessageView };

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function getMyChatsAsClientAction(): Promise<ActionResult<ClientConversationView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return listMyConversationsAsClient(token);
  });
}

export async function getMyChatsAsCoachAction(): Promise<ActionResult<CoachConversationView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return listMyConversationsAsCoach(token);
  });
}

export async function hasAnyChatAction(): Promise<ActionResult<boolean>> {
  return runAction(async () => {
    const token = await requireToken();
    return clientHasAnyConversation(token);
  });
}

export async function getConversationMessagesAction(conversationId: string): Promise<ActionResult<MessageView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return listMessages(token, conversationId);
  });
}

export async function sendChatMessageAction(conversationId: string, body: string): Promise<ActionResult<MessageView>> {
  return runAction(async () => {
    const token = await requireToken();
    return sendMessage(token, conversationId, body);
  });
}

export async function getClientChatsForAdminAction(clientId: string): Promise<ActionResult<AdminConversationView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    return listAllConversationsForClient(token, clientId);
  });
}
