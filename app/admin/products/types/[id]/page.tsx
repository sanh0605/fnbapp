import { notFound } from "next/navigation";
import { resolveActor } from "@/lib/auth/auth";
import { getProductTypes } from "@/app/admin/products/types/actions";
import { ProductTypeDetailView } from "./components/ProductTypeDetailView";
import { safeReturnTo } from "@/lib/shared/return-to";

export const dynamic = "force-dynamic";

export default async function ProductTypeDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [typeRows, auth] = await Promise.all([
    getProductTypes(),
    resolveActor(),
  ]);

  const row = typeRows.find((r) => r.type.id === params.id);
  if (!row) {
    notFound();
  }

  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const rawReturnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/products/types",
  );
  const returnTo = rawReturnTo.startsWith("/admin/products/types/")
    ? "/admin/products/types"
    : rawReturnTo;

  return (
    <ProductTypeDetailView
      type={row.type}
      categoryNames={row.categoryNames}
      canDelete={canDelete}
      returnTo={returnTo}
    />
  );
}
