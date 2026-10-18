import { findAll } from "@/lib/db/tables";
import { ModifierGroupForm } from "@/app/admin/products/modifier-groups/components/ModifierGroupForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import type { DBProductCategory, DBProduct } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function NewModifierGroupPage(
  props: {
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/modifier-groups");

  const [categories, products] = await Promise.all([
    findAll("Product_Categories") as Promise<DBProductCategory[]>,
    findAll("Products") as Promise<DBProduct[]>,
  ]);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Nhóm tuỳ chọn"
        title="Tạo nhóm tuỳ chọn"
        subtitle="Thêm nhóm tuỳ chọn cho món."
      />
      <ModifierGroupForm
        categories={categories}
        products={products}
        returnTo={returnTo}
      />
    </DetailFrame>
  );
}
