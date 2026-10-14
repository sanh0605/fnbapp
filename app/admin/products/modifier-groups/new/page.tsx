import { findAll } from "@/lib/db/tables";
import { ModifierGroupForm } from "@/app/admin/products/modifier-groups/components/ModifierGroupForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBProductCategory, DBProduct } from "@/types/db";

export const dynamic = "force-dynamic";

function safeReturnTo(raw: string | undefined | null, fallback = "/admin/products/modifier-groups"): string {
  if (!raw) return fallback;
  if (raw === fallback || raw.startsWith(`${fallback}?`) || raw.startsWith(`${fallback}/`)) {
    return raw;
  }
  return fallback;
}

export default async function NewModifierGroupPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/modifier-groups");

  const [categories, products] = await Promise.all([
    findAll("Product_Categories") as Promise<DBProductCategory[]>,
    findAll("Products") as Promise<DBProduct[]>,
  ]);

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhóm tuỳ chọn" />
      <PageHeader
        title="Tạo nhóm tuỳ chọn"
        subtitle="Thêm nhóm tuỳ chọn mới vào Menu bán hàng."
      />
      <ModifierGroupForm
        categories={categories}
        products={products}
        returnTo={returnTo}
      />
    </div>
  );
}
