import { getCashCategories } from "@/app/admin/finance/categories/actions";
import { safeReturnTo } from "@/lib/shared/return-to";
import { MonthlyItemForm } from "../components/MonthlyItemForm";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewMonthlyItemPage(
  props: {
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/finance/monthly-items");
  const categories = await getCashCategories();

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Khoản chi hằng tháng"
        title="Tạo khoản chi hằng tháng"
        subtitle="Khoản chi được nhắc ở Tổng quan mỗi tháng."
      />
      <MonthlyItemForm categories={categories} returnTo={returnTo} />
    </DetailFrame>
  );
}
