"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { getAllSettings, updateSetting } from "@/lib/services/settings.service";
import { listPackages, createPackage, updatePackage, PackageInput } from "@/lib/services/packages.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface AdminSettingsData {
  settings: { key: string; value: number; description: string | null }[];
  packages: { id: string; name: string; category: "advance" | "addon"; sessions: number; price: number; isActive: boolean }[];
}

const NUMERIC_SETTING_KEYS = [
  "reschedule_cutoff_hours",
  "cancellation_cutoff_hours",
  "default_session_duration_minutes",
  "inactivity_threshold_days",
];

export async function getAdminSettingsAction(): Promise<ActionResult<AdminSettingsData>> {
  return runAction(async () => {
    const token = await requireToken();
    const [settingsRows, packageRows] = await Promise.all([getAllSettings(token), listPackages(token)]);
    return {
      settings: (settingsRows as any[])
        .filter((s) => NUMERIC_SETTING_KEYS.includes(s.key))
        .map((s) => ({ key: s.key, value: Number(s.value), description: s.description })),
      packages: (packageRows as any[])
        .filter((p) => p.is_active)
        .map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          sessions: p.sessions_count,
          price: p.price,
          isActive: p.is_active,
        })),
    };
  });
}

export async function updateSettingAction(key: string, value: number): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await updateSetting(token, key, value);
    return null;
  });
}

export async function createPackageAction(input: PackageInput): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await createPackage(token, input);
    return null;
  });
}

export async function deletePackageAction(packageId: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    const token = await requireToken();
    await updatePackage(token, packageId, { is_active: false });
    return null;
  });
}
