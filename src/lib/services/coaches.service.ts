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

/** Public marketing display (name, photo, specialization, rating) for the
 * logged-out landing page's "Meet the Coaches" section -- no caller/session
 * at all, unlike everything else in this file, so this deliberately doesn't
 * take an accessToken or go through getCallerContext. Uses supabaseAdmin for
 * the same reason getCoachPublicInfo() does: exposes nothing beyond what's
 * already public marketing content, and RLS has no "anonymous visitor"
 * policy to satisfy here. Previously the landing page rendered entirely
 * from static mock data that had drifted from the real roster (fictional
 * coaches with "Book with X" buttons that led nowhere real, and stale
 * ratings for the ones that did exist) -- this makes it live. */
export async function listPublicActiveCoaches(limit = 8) {
  const { data, error } = await supabaseAdmin
    .from("coach_profiles")
    .select("id, specialization, years_experience, rating, review_count, profile:profiles(full_name, photo_url)")
    .eq("status", "active")
    .order("rating", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function listCoaches(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  // No filter on either query -- utilization for every coach is the same
  // set this unfiltered coach_profiles fetch will return, so both can run
  // together instead of using the profile fetch's result to scope the second.
  const [{ data, error }, utilByCoach] = await Promise.all([
    ctx.client.from("coach_profiles").select("*, profile:profiles(full_name, photo_url, phone)"),
    withUtilization(ctx.client),
  ]);
  if (error) throw error;
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
  // Both queries only need coachId, which is already known -- no need to
  // wait on one to run the other.
  const [{ data, error }, utilByCoach] = await Promise.all([
    ctx.client.from("coach_profiles").select("*, profile:profiles(full_name, photo_url, phone)").eq("id", coachId).single(),
    withUtilization(ctx.client, [coachId]),
  ]);
  if (error) throw error;
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

  // role must be app_metadata, not user_metadata -- handle_new_user() reads
  // new.raw_app_meta_data->>'role' specifically (privileged, server-only
  // field a public signUp() caller can never set) so that self-service
  // signup can't escalate to coach/admin by passing role in its own
  // metadata. user_metadata is still the right place for full_name (purely
  // descriptive, no privilege implications).
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
    app_metadata: { role: "coach" },
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

/** Coach-facing Skills field (FEATURE_SPEC_PORTAL_ENHANCEMENTS.md §1.2):
 * append-only, enforced by append_coach_skill() (migration 0034) at the DB
 * layer -- this function has no "replace" or "remove" path at all, by
 * design, so there's nothing here for a client to bypass even if they called
 * this action directly with a different payload. */
export async function appendMySkill(accessToken: string, skill: string) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["coach"]);
  const trimmed = skill.trim();
  if (!trimmed) throw new Error("Skill can't be empty");

  const { data: coach, error: coachError } = await ctx.client.from("coach_profiles").select("id").eq("profile_id", ctx.userId).single();
  if (coachError || !coach) throw coachError ?? new Error("Coach profile not found");

  const { error } = await ctx.client.rpc("append_coach_skill", { p_coach_id: coach.id, p_skill: trimmed });
  if (error) throw error;
}

/** Admin retains full edit/remove rights on the same Skills field -- a plain
 * replace, unlike the coach's append-only path above. */
export async function updateCoachSkills(accessToken: string, coachId: string, skills: string[]) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { error } = await ctx.client.from("coach_profiles").update({ skills }).eq("id", coachId);
  if (error) throw error;
}

/** Admin full edit of a coach's identity/professional fields -- until this,
 * a coach's name/specialization/bio/languages could only ever be set once,
 * at creation, with no way to correct a typo or update them afterward.
 * full_name lives on `profiles`, everything else on `coach_profiles`, so
 * this is two updates -- both covered by profiles_admin_all/
 * coach_profiles_admin_all RLS for an admin caller, no service-role bypass
 * needed. Distinct from updateCoachSkills() above, which only ever touches
 * the separate `skills` column. */
export async function updateCoach(
  accessToken: string,
  coachId: string,
  patch: {
    fullName?: string;
    specialization?: string;
    yearsExperience?: number;
    bio?: string;
    secondarySpecializations?: string[];
    languages?: string[];
  }
) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);

  const { data: coach, error: coachFetchError } = await ctx.client.from("coach_profiles").select("profile_id").eq("id", coachId).single();
  if (coachFetchError || !coach) throw coachFetchError ?? new Error("Coach not found");

  const coachPatch: Record<string, unknown> = {};
  if (patch.specialization !== undefined) coachPatch.specialization = patch.specialization;
  if (patch.yearsExperience !== undefined) coachPatch.years_experience = patch.yearsExperience;
  if (patch.bio !== undefined) coachPatch.bio = patch.bio;
  if (patch.secondarySpecializations !== undefined) coachPatch.secondary_specializations = patch.secondarySpecializations;
  if (patch.languages !== undefined) coachPatch.languages = patch.languages;

  // Two different tables/rows, neither's write depends on the other -- run
  // together instead of one-then-the-other.
  const [nameResult, coachResult] = await Promise.all([
    patch.fullName !== undefined
      ? ctx.client.from("profiles").update({ full_name: patch.fullName }).eq("id", coach.profile_id)
      : Promise.resolve({ error: null }),
    Object.keys(coachPatch).length > 0
      ? ctx.client.from("coach_profiles").update(coachPatch).eq("id", coachId)
      : Promise.resolve({ error: null }),
  ]);
  if (nameResult.error) throw nameResult.error;
  if (coachResult.error) throw coachResult.error;
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
