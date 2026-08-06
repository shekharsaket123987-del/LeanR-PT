"use server";

import { getAccessToken } from "@/lib/supabase/server-client";
import { ActionResult, runAction } from "./action-result";
import { listSales } from "@/lib/services/sales.service";

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("Not authenticated");
  return token;
}

export interface AdminSaleView {
  subscriptionId: string;
  clientId: string;
  clientCode: string;
  clientName: string;
  packageName: string;
  amount: number;
  saleDate: string;
}

export async function listSalesAction(): Promise<ActionResult<AdminSaleView[]>> {
  return runAction(async () => {
    const token = await requireToken();
    const rows = await listSales(token);
    return (rows as any[]).map((r) => ({
      subscriptionId: r.subscription_id,
      clientId: r.client_id,
      clientCode: r.client_code ?? "",
      clientName: r.client_name ?? "Client",
      packageName: r.package_name ?? "",
      amount: Number(r.amount ?? 0),
      saleDate: r.sale_date,
    }));
  });
}
