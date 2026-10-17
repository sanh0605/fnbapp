import { CategoryForm } from "../components/CategoryForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewCashCategoryPage(props: { searchParams?: Promise<{ returnTo?: string }> }) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance/categories");
  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Nhóm thu chi"
        title="Tạo nhóm thu chi"
        subtitle="Đặt tên các nhóm chi và thu."
      />
      <CategoryForm returnTo={returnTo} />
    </DetailFrame>
  );
}
