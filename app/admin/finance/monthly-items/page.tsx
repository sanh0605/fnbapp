import { Suspense } from "react";
import { getMonthlyItems } from "./actions";
import { getCashCategories } from "@/app/admin/finance/categories/actions";
import MonthlyItemsClient from "./components/MonthlyItemsClient";

export const dynamic = "force-dynamic";

export default async function MonthlyItemsPage(
  props: {
    searchParams?: Promise<{ q?: string; status?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const [items, categories] = await Promise.all([
    getMonthlyItems(),
    getCashCategories(),
  ]);

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <MonthlyItemsClient
        items={items}
        categories={categories}
        initialSearch={searchParams?.q}
        initialStatus={searchParams?.status}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
