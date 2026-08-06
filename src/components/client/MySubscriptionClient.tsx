import { Receipt } from "lucide-react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { MySubscriptionView } from "@/lib/actions/client-portal.actions";
import { formatDate } from "@/lib/utils";

export default function MySubscriptionClient({ subscription }: { subscription: MySubscriptionView }) {
  const pauseDaysRemaining = Math.max(0, subscription.pauseDaysAllowed - subscription.pauseDaysUsed);

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <p className="mb-3 text-xs font-bold uppercase text-black/40">Current Plan</p>
        {subscription.packageName ? (
          <>
            <p className="text-sm font-bold">{subscription.packageName}</p>
            <p className="mt-1 text-xs text-black/45">
              {subscription.sessionsUsed} used · {subscription.sessionsRemaining} remaining of {subscription.sessionsTotal}
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/5">
              <div
                className="h-full rounded-full bg-brand-yellow"
                style={{ width: `${Math.min(100, (subscription.sessionsUsed / Math.max(1, subscription.sessionsTotal)) * 100)}%` }}
              />
            </div>
            {subscription.pauseDaysAllowed > 0 && (
              <p className="mt-3 border-t border-black/[0.06] pt-3 text-xs text-black/50">
                {pauseDaysRemaining.toFixed(1)} of {subscription.pauseDaysAllowed} pause-days remaining
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-black/40">No active plan.</p>
        )}
      </Card>

      <div>
        <h2 className="text-display mb-4 text-lg font-bold italic">Payment History</h2>
        {subscription.payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments yet" description="Your purchase history will show up here." />
        ) : (
          <Card className="divide-y divide-black/[0.05]">
            {subscription.payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-bold">{p.packageName}</p>
                  <p className="text-xs text-black/40">{formatDate(p.saleDate)}</p>
                </div>
                <p className="text-sm font-bold">₹{p.amount.toLocaleString("en-IN")}</p>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
