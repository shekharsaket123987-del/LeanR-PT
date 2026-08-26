import { UserPlus } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import SignupForm from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <AuthLayout
      title="Let's get started."
      subtitle="Create your account, then pick a plan or try a demo session with a coach."
      roleLabel="Create Account"
      roleIcon={UserPlus}
      imageSeed="client-signup"
    >
      <SignupForm />
    </AuthLayout>
  );
}
