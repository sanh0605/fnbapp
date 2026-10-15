import { CategoryForm } from "../components/CategoryForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewCashCategoryPage(props: { searchParams?: Promise<{ returnTo?: string }> }) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance/categories");
  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhóm thu chi" />
      <PageHeader title="Tạo nhóm thu chi" subtitle="Đặt tên các nhóm chi và thu." />
      <CategoryForm returnTo={returnTo} />
    </div>
  );
}
