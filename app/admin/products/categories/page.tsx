import { Suspense } from "react";
import { findAll } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import { getCategoriesWithCounts } from "./actions";
import CategoriesClient from "@/app/admin/products/categories/components/CategoriesClient";
import type { DBProductType } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function ProductCategoriesPage(
  props: {
    searchParams?: Promise<{ q?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const [{ categories, counts }, types, auth] = await Promise.all([
    getCategoriesWithCounts(),
    findAll("Product_Types") as Promise<DBProductType[]>,
    resolveActor(),
  ]);
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <CategoriesClient
        categories={categories}
        counts={counts}
        types={types}
        initialSearch={searchParams?.q || ""}
        initialPage={searchParams?.page}
        canDelete={canDelete}
      />
    </Suspense>
  );
}
