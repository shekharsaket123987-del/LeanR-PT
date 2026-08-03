import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

// coach_utilization_view has no FK to coach_profiles, so PostgREST can't
// embed it as a relationship — fetch separately and merge in JS instead.
async function withUtilization(client: Awaited<ReturnType<typeof getCallerContext>>["client"], coachIds?: string[]) {
  let query = client.from("coach_utilization_view").select("coach_id, active_clients, utilization_pct");
  if (coachIds) query = query.in("coach_id", coachIds);
  const { data, error } = await query;
  if (error) throw error;
  return new Map((data ?? []).map((u) => [u.coach_id, u]));
}

/** Public display info (name, photo, specialization) for a coach the caller
 * has no relationship with yet — e.g. showing who a client was just matched
 * with, before a booking/recurring_slot exists to satisfy the normal
 * `profiles_select_linked_as_client` RLS policy. Uses the admin client
 * deliberately, same pattern as createAssessmentBooking(); exposes nothing
 * beyond what's already shown on the public coach carousel. */
export async function getCoachPublicInfo(coachId: string) {
  const { data, error } = await supabaseAdmin
    .from("coach_profiles")
    .select("id, specialization, profile:profiles(full_name, photo_url)")
    .eq("id", coachId)
    .single();
  if (error) throw error;
  return data;
}

export async function listCoaches(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("coach_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone)");
  if (error) throw error;

  const utilByCoach = await withUtilization(ctx.client, (data ?? []).map((c) => c.id));
  return (data ?? []).map((c) => ({ ...c, utilization: utilByCoach.get(c.id) ?? null }));
}

export async function getMyCoachProfile(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data, error } = await ctx.client
    .from("coach_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone)")
    .eq("profile_id", ctx.userId)
    .single();
  if (error) throw error;

  const utilByCoach = await withUtilization(ctx.client, [data.id]);
  return { ...data, utilization: utilByCoach.get(data.id) ?? null };
}

export async function getCoach(accessToken: string, coachId: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client
    .from("coach_profiles")
    .select("*, profile:profiles(full_name, photo_url, phone)")
    .eq("id", coachId)
    .single();
  if (error) throw error;

  const utilByCoach = await withUtilization(ctx.client, [coachId]);
  return { ...data, utilization: utilByCoach.get(coachId) ?? null };
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}:00`;
}

export interface CoachSlotPattern {
  days: number[]; // 0-6, Sunday-Saturday
  startTime: string; // "14:00"
  durationMinutes?: number; // defaults to 60
}

/** Admin "Add Coach" persona builder: provisions the login (which the
 * existing handle_new_user() DB trigger turns into profiles + coach_profiles
 * rows), then fills in the persona details and generates coach_availability
 * rows from the slot patterns in one step. */
export async function createCoach(
  accessToken: string,
  input: {
    fullName: string;
    email: string;
    password: string;
    employeeCode: string;
    specialization: string;
    skills: string[];
    languages: string[];
    slots: CoachSlotPattern[];
  }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { role: "coach", full_name: input.fullName },
  });
  if (createError || !created.user) throw createError ?? new Error("Failed to create coach account");

  const { data: coachRow, error: coachError } = await supabaseAdmin
    .from("coach_profiles")
    .update({
      employee_code: input.employeeCode,
      specialization: input.specialization,
      secondary_specializations: input.skills,
      languages: input.languages,
    })
    .eq("profile_id", created.user.id)
    .select("id")
    .single();
  if (coachError || !coachRow) throw coachError ?? new Error("Failed to save coach persona details");

  const windows = input.slots.flatMap((slot) =>
    slot.days.map((day) => ({
      coach_id: coachRow.id,
      day_of_week: day,
      start_time: `${slot.startTime}:00`,
      end_time: addMinutes(slot.startTime, slot.durationMinutes ?? 60),
      is_active: true,
    }))
  );
  if (windows.length > 0) {
    const { error: availError } = await supabaseAdmin.from("coach_availability").insert(windows);
    if (availError) throw availError;
  }

  return coachRow.id as string;
}

/** Admin "Disable Coach" control. coach_profiles.status also drives
 * coach_status-dependent UI elsewhere (badge color, etc.) — no separate
 * "deleted" state exists, since a hard delete would orphan booking/audit
 * history via FK; the client-detail "Delete Coach" button is relabeled to
 * call this same function instead. */
export async function updateCoachStatus(accessToken: string, coachId: string, status: "active" | "inactive" | "on-leave") {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.from("coach_profiles").update({ status }).eq("id", coachId).select().single();
  if (error) throw error;
  return data;
}

export async function updateMyCoachProfile(
  accessToken: string,
  patch: Partial<{
    specialization: string;
    secondary_specializations: string[];
    years_experience: number;
    bio: string;
    certifications: string[];
    languages: string[];
  }>
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const { data, error } = await ctx.client
    .from("coach_profiles")
    .update(patch)
    .eq("profile_id", ctx.userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
