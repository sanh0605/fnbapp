import { notFound } from "next/navigation";
import { findById } from "@/lib/db/tables";
import { CategoryForm } from "@/app/admin/inventory/components/CategoryForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import type { DBItemCategory } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
}: {
  params: { id: string };
}) {
  const category = (await findById("Item_Categories", params.id)) as DBItemCategory | null;
  if (!category) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href="/admin/inventory/categories" label="Phân loại hàng" />
      <PageHeader
        title={`Sửa Phân Loại: ${category.name}`}
        subtitle="Cập nhật thông tin phân loại hàng hóa."
      />
      <CategoryForm initialData={category} returnTo="/admin/inventory/categories" />
    </div>
  );
}
