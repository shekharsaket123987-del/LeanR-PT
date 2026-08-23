import PageHeader from "@/components/shared/PageHeader";
import ClientProfileClient from "@/components/client/ClientProfileClient";
import { getMyProfileAction } from "@/lib/actions/client-profile.actions";
import { isFailure } from "@/lib/actions/action-result";

export default async function ClientProfilePage() {
  const result = await getMyProfileAction();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" description="Manage your personal and health information." />
      {isFailure(result) ? (
        <p className="text-sm text-red-400">{result.error.message}</p>
      ) : (
        <ClientProfileClient profile={result.data} />
      )}
    </div>
  );
}
