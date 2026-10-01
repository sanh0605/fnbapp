import { CategoryForm } from "@/app/admin/inventory/components/CategoryForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function NewCategoryPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/admin/inventory/categories" label="Phân loại hàng" />
      <PageHeader
        title="Tạo Phân Loại Hàng Hoá"
        subtitle="Tự do tạo các phân loại tuỳ chỉnh (Bao bì, Nguyên liệu ướt, v.v.)."
      />
      <CategoryForm returnTo="/admin/inventory/categories" />
    </div>
  );
}
