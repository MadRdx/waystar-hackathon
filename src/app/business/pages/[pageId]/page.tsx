import { PageBuilder } from "@/components/admin/page-builder";

export default async function EditBusinessPaymentPage({
  params,
}: {
  params: Promise<{ pageId: string }>;
}) {
  const { pageId } = await params;
  return <PageBuilder pageId={pageId} portalBase="/business" />;
}
