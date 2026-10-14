import { findAll } from "@/lib/db/tables";
import { loadProductRows } from "@/app/admin/products/load-product-rows";
import ProductForm from "@/app/admin/products/components/ProductForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products");
  const [{ activeCategories }, optionGroups] = await Promise.all([loadProductRows(), findAll("Modifier_Groups")]);

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Món" />
      <PageHeader
        title="Tạo món"
        subtitle="Thêm món mới vào thực đơn bán hàng."
      />
      <ProductForm
        categories={activeCategories}
        optionGroups={optionGroups}
        selectedOptionGroupIds={[]}
        returnTo={returnTo}
      />
    </div>
  );
}
