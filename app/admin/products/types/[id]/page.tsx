import { notFound } from "next/navigation";
import { resolveActor } from "@/lib/auth/auth";
import { getProductTypes } from "@/app/admin/products/types/actions";
import { ProductTypeDetailView } from "./components/ProductTypeDetailView";

export const dynamic = "force-dynamic";

function safeReturnTo(raw: string | undefined | null, fallback = "/admin/products/types"): string {
  if (!raw) return fallback;
  if (raw === fallback || raw.startsWith(`${fallback}?`) || raw.startsWith(`${fallback}/`)) {
    return raw;
  }
  return fallback;
}

export default async function ProductTypeDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
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
