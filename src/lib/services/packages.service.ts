import { getCallerContext, requireRole } from "./_auth";
import { supabaseAdmin } from "@/lib/supabase/admin-client";

/** Public marketing display for the logged-out landing page's pricing
 * section -- no caller/session, unlike listPackages() below. The
 * package_tiers_select_active RLS policy already allows anon reads of
 * active rows, but this uses supabaseAdmin anyway to match the same
 * public-read pattern as listPublicActiveCoaches(). Previously the landing
 * page rendered pricing from static mock data, so an admin editing/
 * archiving/re-pricing a plan in Plan Management never showed up here even
 * though it was already live everywhere else (the real purchase flow). */
export async function listPublicActivePackages() {
  const { data, error } = await supabaseAdmin
    .from("package_tiers")
    .select("*")
    .eq("is_active", true)
    .order("sessions_count");
  if (error) throw error;
  return data;
}

export async function listPackages(accessToken: string) {
  const ctx = await getCallerContext(accessToken);
  const { data, error } = await ctx.client.from("package_tiers").select("*").order("sessions_count");
  if (error) throw error;
  return data;
}

export interface PackageInput {
  name: string;
  category: "advance" | "addon";
  sessions_count: number;
  price: number;
  original_price?: number;
  features: string[];
  highlighted?: boolean;
}

export async function createPackage(accessToken: string, input: PackageInput) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.from("package_tiers").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function updatePackage(accessToken: string, id: string, patch: Partial<PackageInput & { is_active: boolean }>) {
  const ctx = await getCallerContext(accessToken);
  requireRole(ctx, ["admin"]);
  const { data, error } = await ctx.client.from("package_tiers").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
