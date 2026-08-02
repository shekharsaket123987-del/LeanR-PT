import { ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";

export default function AdminLoginPage() {
  return (
    <AuthLayout
      title="Operations, in control."
      subtitle="Manage clients, coaches, sessions, and platform-wide performance."
      roleLabel="Admin Login"
      roleIcon={ShieldCheck}
      imageSeed="admin-login"
    >
      <LoginForm role="admin" redirectTo="/admin/dashboard" />
    </AuthLayout>
  );
}
