import { PaymentSuccessView } from "@/components/payment/payment-success-view";

export default async function SuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ transaction?: string }>;
}) {
  const { slug } = await params;
  const { transaction } = await searchParams;

  return <PaymentSuccessView slug={slug} transactionId={transaction ?? ""} />;
}
