import { notFound } from "next/navigation";
import { resolveActor } from "@/lib/auth/auth";
import { getCashCategories } from "@/app/admin/finance/categories/actions";
import { safeReturnTo } from "@/app/admin/finance/components/return-to";
import { CategoryDetailView } from "./components/CategoryDetailView";

export const dynamic = "force-dynamic";

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [categories, auth] = await Promise.all([
    getCashCategories(),
    resolveActor(),
  ]);

  const category = categories.find((c) => c.id === params.id);
  if (!category) {
    notFound();
  }

  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined,
    "/admin/finance/categories",
  );
  const returnTo = rawReturnTo.startsWith("/admin/finance/categories/")
    ? "/admin/finance/categories"
    : rawReturnTo;

  return (
    <CategoryDetailView
      category={category}
      returnTo={returnTo}
      canDelete={canDelete}
    />
  );
}
