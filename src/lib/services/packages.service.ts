import { getCallerContext, requireRole } from "./_auth";

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
