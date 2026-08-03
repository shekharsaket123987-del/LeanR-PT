import PageHeader from "@/components/shared/PageHeader";
import DemoBookingClient from "@/components/client/DemoBookingClient";

export default function DemoBookingPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Book a Demo Session" description="Try a live 1:1 session with a coach before you commit to a plan. ₹700." />
      <DemoBookingClient />
    </div>
  );
}
