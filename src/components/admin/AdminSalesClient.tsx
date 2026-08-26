"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Receipt } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { AdminSaleView } from "@/lib/actions/admin-sales.actions";
import { formatDate } from "@/lib/utils";

export default function AdminSalesClient({ sales }: { sales: AdminSaleView[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter(
      (s) => s.clientName.toLowerCase().includes(q) || s.clientCode.toLowerCase().includes(q) || s.packageName.toLowerCase().includes(q)
    );
  }, [sales, query]);

  const total = filtered.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by client, ID, or plan…"
            className="w-full rounded-xl border border-white/15 py-2.5 pl-10 pr-4 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
          />
        </div>
        <p className="text-sm font-bold text-white/60 sm:text-right">
          {filtered.length} sale{filtered.length === 1 ? "" : "s"} · ₹{total.toLocaleString("en-IN")}
        </p>
      </div>

      {filtered.length === 0 && <EmptyState icon={Receipt} title="No sales found" description="No purchases match that search." />}

      <Card className="divide-y divide-white/[0.05]">
        {filtered.map((s) => (
          <div key={s.subscriptionId} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <Link href={`/admin/clients/${s.clientId}`} className="text-sm font-bold hover:underline">
                {s.clientName}
              </Link>
              <p className="truncate text-xs text-white/40">
                {s.clientCode} · {s.packageName}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold">₹{s.amount.toLocaleString("en-IN")}</p>
              <p className="text-xs text-white/40">{formatDate(s.saleDate)}</p>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
