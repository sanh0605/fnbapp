import { notFound } from "next/navigation";
import { getModifiersData } from "@/app/admin/products/modifiers/actions";
import { findAll } from "@/lib/db/tables";
import { ModifierForm } from "@/app/admin/products/modifiers/components/ModifierForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function EditModifierPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/modifiers");
  const [{ modifiers }, products] = await Promise.all([
    getModifiersData(),
    findAll("Products") as Promise<any[]>,
  ]);

  const modifier = modifiers.find((m) => m.id === params.id);
  if (!modifier) {
    notFound();
  }

  const linkedProduct = modifier.product_id
    ? products.find((p) => p.id === modifier.product_id)
    : undefined;
  const productStatus = linkedProduct?.status;

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Topping & tuỳ chọn" />
      <PageHeader
        title={`Sửa Tùy Chọn: ${modifier.name}`}
        subtitle="Cập nhật thông tin tùy chọn và cài đặt bán độc lập."
      />
      <ModifierForm
        initialData={modifier}
        productStatus={productStatus}
        returnTo={returnTo}
      />
    </div>
  );
}
