"use client";

import { useState } from "react";
import { CreditCard, CheckCircle2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

/** Stand-in for a real payment gateway (Razorpay etc, not yet integrated --
 * see PRODUCT_ROADMAP.md/business-rules.md). Always succeeds after a short
 * delay so the surrounding purchase/demo-booking flows can be built and
 * demoed end-to-end now; swapping in a real gateway later only means
 * replacing this one component, not the flows that call it. */
export default function StubPaymentModal({
  open,
  onClose,
  amountRupees,
  title = "Complete Payment",
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  amountRupees: number;
  title?: string;
  onSuccess: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);

  function pay() {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setPaid(true);
      setTimeout(() => {
        setPaid(false);
        onSuccess();
      }, 900);
    }, 1400);
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {paid ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <p className="text-display text-xl font-bold italic">Payment Successful</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-black/45">Payment gateway integration is coming soon -- this is a placeholder checkout for demo purposes.</p>
          <div className="flex items-center justify-between rounded-xl bg-black/[0.03] p-4">
            <span className="text-sm font-semibold">Amount Payable</span>
            <span className="text-display text-xl font-bold italic">₹{amountRupees.toLocaleString("en-IN")}</span>
          </div>
          <Button className="w-full" loading={paying} onClick={pay}>
            <CreditCard className="h-4 w-4" /> Pay ₹{amountRupees.toLocaleString("en-IN")}
          </Button>
        </div>
      )}
    </Modal>
  );
}
