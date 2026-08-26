import { UserRound } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";

export default function ClientLoginPage() {
  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Log in to book sessions, track progress, and stay connected with your coach."
      roleLabel="Client Login"
      roleIcon={UserRound}
      imageSeed="client-login"
    >
      <LoginForm role="client" redirectTo="/client/dashboard" />
    </AuthLayout>
  );
}
