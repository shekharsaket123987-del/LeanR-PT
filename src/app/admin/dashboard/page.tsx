"use client";

import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Users, UserCheck, CalendarCheck2, XCircle, TrendingUp, Clock, LayoutGrid, IndianRupee } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import { adminMetrics, revenueTrend, bookingsByHour, utilizationByCoach } from "@/lib/mock-data";

export default function AdminDashboardPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Overview" description="Platform performance across clients, coaches, and sessions." />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total Clients" value={adminMetrics.totalClients} change="+18 this month" />
        <StatCard icon={UserCheck} label="Active PT Clients" value={adminMetrics.activePTClients} change="+9" />
        <StatCard icon={CalendarCheck2} label="Sessions Booked Today" value={adminMetrics.sessionsBookedToday} />
        <StatCard icon={XCircle} label="Cancelled Today" value={adminMetrics.sessionsCancelledToday} positive={false} change={`${adminMetrics.sessionsCancelledToday}`} />
        <StatCard icon={TrendingUp} label="Trainer Utilization" value={`${adminMetrics.trainerUtilization}%`} accent />
        <StatCard icon={Clock} label="Peak Booking Hours" value={adminMetrics.peakBookingHour} />
        <StatCard icon={LayoutGrid} label="Empty Slots" value={adminMetrics.emptySlotCount} positive={false} change={`${adminMetrics.emptySlotCount} open`} />
        <StatCard icon={IndianRupee} label="Revenue This Month" value={`₹${(adminMetrics.revenueThisMonth / 100000).toFixed(1)}L`} change="+6.7%" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <p className="mb-1 text-sm font-bold">Revenue Trend</p>
          <p className="mb-4 text-xs text-black/45">Last 6 months</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#00000066" }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#00000066" }}
                width={50}
                tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #00000010", fontSize: 12 }}
                formatter={(v: number) => [`₹${(v / 100000).toFixed(1)}L`, "Revenue"]}
              />
              <Line type="monotone" dataKey="revenue" stroke="#111111" strokeWidth={2.5} dot={{ fill: "#F5E400", stroke: "#111111", strokeWidth: 2, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <p className="mb-1 text-sm font-bold">Avg. Sessions / Client</p>
          <p className="mb-4 text-xs text-black/45">Across active clients</p>
          <p className="text-display text-5xl font-bold italic">{adminMetrics.avgSessionsPerClient}</p>
          <div className="mt-6 space-y-3">
            {utilizationByCoach.slice(0, 5).map((c) => (
              <div key={c.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-black/40">{c.utilization}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
                  <div className="h-full rounded-full bg-brand-yellow" style={{ width: `${c.utilization}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <p className="mb-1 text-sm font-bold">Bookings by Hour</p>
        <p className="mb-4 text-xs text-black/45">Today across all coaches</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={bookingsByHour}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#00000010" />
            <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#00000066" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#00000066" }} width={24} />
            <Tooltip cursor={{ fill: "#0000000A" }} contentStyle={{ borderRadius: 12, border: "1px solid #00000010", fontSize: 12 }} />
            <Bar dataKey="bookings" fill="#111111" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
