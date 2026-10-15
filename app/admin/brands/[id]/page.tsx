import { notFound } from "next/navigation";
import { findAll } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import { safeReturnTo } from "@/lib/shared/return-to";
import {
  BrandDetailView,
  type BrandOutletItem,
} from "./components/BrandDetailView";
import type { DBBrand, DBOutlet } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [allBrands, allOutlets, auth] = await Promise.all([
    findAll("Brands") as Promise<DBBrand[]>,
    findAll("Outlets") as Promise<DBOutlet[]>,
    resolveActor(),
  ]);

  const brand = allBrands.find(
    (b) => b.id === params.id,
  );
  if (!brand) {
    notFound();
  }

  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  const outlets: BrandOutletItem[] = allOutlets
    .filter((o) => o.brand_id === brand.id)
    .map((o) => ({ id: o.id, name: o.name }));

  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined, "/admin/brands");
  const returnTo = rawReturnTo.startsWith("/admin/brands/")
    ? "/admin/brands"
    : rawReturnTo;

  return (
    <BrandDetailView
      brand={brand}
      outlets={outlets}
      canDelete={canDelete}
      returnTo={returnTo}
    />
  );
}
