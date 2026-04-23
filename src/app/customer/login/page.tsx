import { Suspense } from "react";

import { CustomerAuthForm } from "@/components/customer/customer-auth-form";

export default function CustomerLoginPage() {
  return (
    <Suspense fallback={null}>
      <CustomerAuthForm mode="login" />
    </Suspense>
  );
}
