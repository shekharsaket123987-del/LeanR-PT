import PageHeader from "@/components/shared/PageHeader";
import OnboardingFormClient from "@/components/client/OnboardingFormClient";

export default function OnboardingPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Initial Assessment" description="Help your coach understand your starting point before your first session." />
      <OnboardingFormClient />
    </div>
  );
}
