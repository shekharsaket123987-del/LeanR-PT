"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, ChevronRight, Star } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { coaches } from "@/lib/mock-data";

export default function AdminCoachesPage() {
  const [query, setQuery] = useState("");
  const filtered = coaches.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Coaches"
        description={`${coaches.length} coaches on the platform.`}
        action={<Button href="/admin/coaches/new">+ Add Coach</Button>}
      />

      <div className="relative mb-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search coaches..."
          className="w-full max-w-md rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-4 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-12 gap-4 border-b border-black/[0.06] px-5 py-3 text-xs font-bold uppercase text-black/40 sm:grid">
          <div className="col-span-4">Coach</div>
          <div className="col-span-2">Utilization</div>
          <div className="col-span-2">Active Clients</div>
          <div className="col-span-2">Rating</div>
          <div className="col-span-1">Status</div>
          <div className="col-span-1"></div>
        </div>
        <div className="divide-y divide-black/[0.05]">
          {filtered.map((c) => (
            <Link key={c.id} href={`/admin/coaches/${c.id}`} className="grid grid-cols-2 items-center gap-4 px-5 py-4 hover:bg-black/[0.02] sm:grid-cols-12">
              <div className="col-span-2 flex items-center gap-3 sm:col-span-4">
                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
                  <Image src={c.photo} alt={c.name} fill className="object-cover" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{c.name}</p>
                  <p className="truncate text-xs text-black/40">{c.specialization}</p>
                </div>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-black/5">
                    <div className="h-full rounded-full bg-brand-yellow" style={{ width: `${c.utilization}%` }} />
                  </div>
                  <span className="text-xs text-black/50">{c.utilization}%</span>
                </div>
              </div>
              <div className="col-span-1 text-sm text-black/60 sm:col-span-2">{c.activeClients}</div>
              <div className="col-span-1 flex items-center gap-1 text-sm text-black/60 sm:col-span-2">
                <Star className="h-3.5 w-3.5 fill-brand-yellow text-brand-yellow" /> {c.rating}
              </div>
              <div className="col-span-1">
                <Badge variant={c.status === "active" ? "green" : c.status === "on-leave" ? "outline-yellow" : "gray"}>{c.status}</Badge>
              </div>
              <ChevronRight className="col-span-1 hidden h-4 w-4 justify-self-end text-black/30 sm:block" />
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
