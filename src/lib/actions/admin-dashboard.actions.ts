"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { AdminDashboardData, getAdminDashboard } from "@/lib/services/adminDashboard.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function getAdminDashboardAction(): Promise<ActionResult<AdminDashboardData>> {
  return runAction(async () => {
    const token = await requireToken();
    return getAdminDashboard(token);
  });
}
