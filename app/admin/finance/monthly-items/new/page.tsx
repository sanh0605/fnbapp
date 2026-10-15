import { getCashCategories } from "@/app/admin/finance/categories/actions";
import { safeReturnTo } from "@/lib/shared/return-to";
import { MonthlyItemForm } from "../components/MonthlyItemForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

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
    <div className="space-y-6">
      <BackLink href={returnTo} label="Khoản chi hằng tháng" />
      <PageHeader
        title="Tạo khoản chi hằng tháng"
        subtitle="Khoản chi được nhắc ở Tổng quan mỗi tháng."
      />
      <MonthlyItemForm categories={categories} returnTo={returnTo} />
    </div>
  );
}
