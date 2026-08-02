import { CalendarCheck, BellRing, Star, Info } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { notifications } from "@/lib/mock-data";
import { formatDate, formatTime } from "@/lib/utils";

const icons: Record<string, any> = {
  booking: CalendarCheck,
  reminder: BellRing,
  feedback: Star,
  system: Info,
};

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" description="Booking confirmations, reminders, and feedback requests." />

      {notifications.length === 0 && (
        <EmptyState icon={BellRing} title="You're all caught up" description="New notifications will show up here." />
      )}

      <div className="space-y-2">
        {notifications.map((n) => {
          const Icon = icons[n.type];
          return (
            <Card key={n.id} className={`flex items-start gap-4 p-4 ${!n.read ? "border-brand-yellow/50 bg-brand-yellow/[0.04]" : ""}`}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
                <Icon className="h-4.5 w-4.5 text-black/60" style={{ height: 18, width: 18 }} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold">{n.title}</p>
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-yellow" />}
                </div>
                <p className="mt-0.5 text-sm text-black/50">{n.message}</p>
                <p className="mt-1.5 text-[11px] text-black/30">
                  {formatDate(n.time)} · {formatTime(n.time)}
                </p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
