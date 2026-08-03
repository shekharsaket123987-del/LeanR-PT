"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { createProgressLog, listProgressLogsForClient, ProgressLogInput } from "@/lib/services/progressLogs.service";
import { getMyClientProfile } from "@/lib/services/clients.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface ProgressLogView {
  id: string;
  loggedAt: string;
  weight: number | null;
  bodyFatPct: number | null;
  musclePct: number | null;
  waist: number | null;
  chest: number | null;
  hip: number | null;
  arms: number | null;
  thigh: number | null;
}

function toView(row: any): ProgressLogView {
  return {
    id: row.id,
    loggedAt: row.logged_at,
    weight: row.weight,
    bodyFatPct: row.body_fat_pct,
    musclePct: row.muscle_pct,
    waist: row.waist,
    chest: row.chest,
    hip: row.hip,
    arms: row.arms,
    thigh: row.thigh,
  };
}

export interface MyProgressData {
  logs: ProgressLogView[];
  dayOne: ProgressLogView | null;
  latest: ProgressLogView | null;
  canSubmitThisWeek: boolean;
}

export async function getMyProgressAction(): Promise<ActionResult<MyProgressData>> {
  return runAction(async () => {
    const token = await requireToken();
    const client: any = await getMyClientProfile(token);
    const rows = await listProgressLogsForClient(token, client.id);
    const sorted = (rows as any[]).sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
    const dayOne = sorted.length > 0 ? toView(sorted[0]) : null;
    const latest = sorted.length > 0 ? toView(sorted[sorted.length - 1]) : null;

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const canSubmitThisWeek = !sorted.some((r) => new Date(r.logged_at) >= weekAgo);

    return { logs: sorted.reverse().map(toView), dayOne, latest, canSubmitThisWeek };
  });
}

export async function submitMyProgressAction(input: ProgressLogInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    const client: any = await getMyClientProfile(token);
    await createProgressLog(token, client.id, input);
    return null;
  });
}
