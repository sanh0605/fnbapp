import { CategoryForm } from "../components/CategoryForm";
import { safeReturnTo } from "../../components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function NewCashCategoryPage({ searchParams }: { searchParams?: { returnTo?: string } }) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance/categories");
  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhóm thu chi" />
      <PageHeader title="Thêm nhóm thu chi" subtitle="Đặt tên các nhóm chi và thu." />
      <CategoryForm returnTo={returnTo} />
    </div>
  );
}
