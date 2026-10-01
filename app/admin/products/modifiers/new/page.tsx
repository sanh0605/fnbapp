import { ModifierForm } from "@/app/admin/products/modifiers/components/ModifierForm";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewModifierPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/modifiers");

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Topping & tuỳ chọn" />
      <PageHeader
        title="Thêm Tùy Chọn Mới"
        subtitle="Thêm tùy chọn mới vào Menu bán hàng."
      />
      <ModifierForm returnTo={returnTo} />
    </div>
  );
}
