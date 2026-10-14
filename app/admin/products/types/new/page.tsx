import { ProductTypeForm } from "@/app/admin/products/types/components/ProductTypeForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

function safeReturnTo(raw: string | undefined | null, fallback = "/admin/products/types"): string {
  if (!raw) return fallback;
  if (raw === fallback || raw.startsWith(`${fallback}?`) || raw.startsWith(`${fallback}/`)) {
    return raw;
  }
  return fallback;
}

export default async function NewProductTypePage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/products/types");

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Loại món" />
      <PageHeader
        title="Tạo loại món"
        subtitle="Thêm loại sản phẩm mới vào Menu bán hàng."
      />
      <ProductTypeForm returnTo={returnTo} />
    </div>
  );
}
