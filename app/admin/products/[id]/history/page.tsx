import { notFound } from "next/navigation";
import { loadProductRows } from "@/app/admin/products/load-product-rows";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { PriceHistoryView } from "@/app/admin/products/[id]/history/components/PriceHistoryView";

export const dynamic = "force-dynamic";

export default async function ProductPriceHistoryPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");
  const { enhancedProducts } = await loadProductRows();

  const product = enhancedProducts.find((p) => p.id === params.id);
  if (!product) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Món" />
      <PageHeader
        title={`Lịch sử giá: ${product.name}`}
        subtitle={`Lịch sử các lần thay đổi giá bán của món ${product.name}.`}
      />
      <PriceHistoryView priceHistory={product.priceHistory} productName={product.name} />
    </div>
  );
}
