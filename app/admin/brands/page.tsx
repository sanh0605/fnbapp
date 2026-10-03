import { Suspense } from "react";
import { findAll } from "@/lib/db/tables";
import { resolveActor } from "@/lib/auth/auth";
import BrandsClient from "./components/BrandsClient";
import type { DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const [allBrands, auth] = await Promise.all([
    findAll("Brands") as Promise<DBBrand[]>,
    resolveActor(),
  ]);
  const brands = allBrands.filter((b: DBBrand) => b.status !== "DELETED");
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <BrandsClient
        brands={brands}
        canDelete={canDelete}
        initialSearch={searchParams?.q}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
