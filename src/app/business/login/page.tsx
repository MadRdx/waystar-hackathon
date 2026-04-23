import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";

export default function BusinessLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm role="BUSINESS" defaultNext="/business" />
    </Suspense>
  );
}
