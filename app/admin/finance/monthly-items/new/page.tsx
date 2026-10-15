import { getCashCategories } from "@/app/admin/finance/categories/actions";
import { MonthlyItemForm } from "../components/MonthlyItemForm";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

function safeReturnTo(raw: string | undefined | null, fallback: string = "/admin/finance/monthly-items"): string {
  if (!raw) return fallback;
  if (raw.startsWith("/admin/finance/monthly-items")) return raw;
  return fallback;
}

export default async function NewMonthlyItemPage(
  props: {
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(searchParams?.returnTo);
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
