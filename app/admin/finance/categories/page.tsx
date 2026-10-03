import { Suspense } from "react";
import { resolveActor } from "@/lib/auth/auth";
import { getCashCategories } from "./actions";
import CategoriesClient from "./components/CategoriesClient";

export const dynamic = "force-dynamic";

export default async function CashCategoriesPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; page?: string };
}) {
  const [categories, auth] = await Promise.all([
    getCashCategories(),
    resolveActor(),
  ]);
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <CategoriesClient
        categories={categories}
        canDelete={canDelete}
        initialSearch={searchParams?.q}
        initialStatus={searchParams?.status}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
