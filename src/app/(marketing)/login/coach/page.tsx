import { Dumbbell } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import LoginForm from "@/components/auth/LoginForm";

export default function CoachLoginPage() {
  return (
    <AuthLayout
      title="Ready to coach."
      subtitle="Access your schedule, client notes, and session tools."
      roleLabel="Coach Login"
      roleIcon={Dumbbell}
      imageSeed="coach-login"
    >
      <LoginForm role="coach" redirectTo="/coach/dashboard" />
    </AuthLayout>
  );
}
