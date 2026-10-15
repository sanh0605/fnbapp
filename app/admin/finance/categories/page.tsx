import { Suspense } from "react";
import { getCashCategories } from "./actions";
import CategoriesClient from "./components/CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CashCategoriesPage(
  props: {
    searchParams?: Promise<{ q?: string; status?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const categories = await getCashCategories();

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <CategoriesClient
        categories={categories}
        initialSearch={searchParams?.q}
        initialStatus={searchParams?.status}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
