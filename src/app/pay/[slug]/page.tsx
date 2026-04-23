import { Suspense } from "react";

import { PublicPaymentPage } from "@/components/payment/public-payment-page";

export default async function PayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense fallback={null}>
      <PublicPaymentPage slug={slug} />
    </Suspense>
  );
}
