import { Suspense } from "react";
import { getOutlets } from "@/app/admin/outlets/actions";
import { getBrands } from "@/app/admin/brands/actions";
import OutletsClient from "./components/OutletsClient";
import type { DBOutlet, DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function OutletsPage({
  searchParams,
}: {
  searchParams?: { q?: string; status?: string; page?: string };
}) {
  const [outlets, brands] = await Promise.all([
    getOutlets() as Promise<DBOutlet[]>,
    getBrands() as Promise<DBBrand[]>,
  ]);

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <OutletsClient
        outlets={outlets}
        brands={brands}
        initialSearch={searchParams?.q}
        initialStatus={searchParams?.status}
        initialPage={searchParams?.page}
      />
    </Suspense>
  );
}
