import { Suspense } from "react";

import { CustomerAuthForm } from "@/components/customer/customer-auth-form";

export default function CustomerRegisterPage() {
  return (
    <Suspense fallback={null}>
      <CustomerAuthForm mode="register" />
    </Suspense>
  );
}
