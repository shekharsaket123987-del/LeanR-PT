"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { ClientSearchResultView } from "@/lib/actions/coach-portal.actions";

export default function CoachSearchClient({ clients }: { clients: ClientSearchResultView[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.clientCode.toLowerCase().includes(q));
  }, [clients, query]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any client by name or client ID…"
          className="w-full rounded-xl border border-white/15 py-3 pl-10 pr-4 text-sm focus:border-brand-yellow focus:outline-none focus:ring-1 focus:ring-brand-yellow"
        />
      </div>

      <div className="mt-4 space-y-2">
        {query.trim().length === 0 && (
          <p className="px-1 text-xs text-white/40">Search across every client on the platform, not just your own.</p>
        )}
        {query.trim().length > 0 && filtered.length === 0 && (
          <EmptyState icon={Search} title="No matches" description="No client's name or client ID matches that search." />
        )}
        {filtered.map((c) => (
          <Link key={c.id} href={`/coach/clients/${c.id}`}>
            <Card className="flex items-center gap-3 p-3.5 transition-colors hover:bg-white/[0.02]">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl">
                <Image src={c.photo} alt={c.name} fill className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{c.name}</p>
                <p className="truncate text-xs text-white/45">{c.clientCode}</p>
              </div>
              {c.isAssignedToMe ? <Badge variant="green">Your client</Badge> : <Badge variant="gray">Read-only</Badge>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
