import { notFound } from "next/navigation";
import { getOutlets } from "@/app/admin/outlets/actions";
import { getBrands } from "@/app/admin/brands/actions";
import { safeReturnTo } from "@/app/admin/outlets/components/return-to";
import { OutletDetailView } from "./components/OutletDetailView";
import type { DBOutlet, DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function OutletDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const [outlets, brands] = await Promise.all([
    getOutlets() as Promise<DBOutlet[]>,
    getBrands() as Promise<DBBrand[]>,
  ]);

  const outlet = outlets.find((o) => o.id === params.id);
  if (!outlet) {
    notFound();
  }

  const brand = brands.find((b) => b.id === outlet.brand_id);
  const brandName = brand ? brand.name : outlet.brand_id;

  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined,
  );
  const returnTo = rawReturnTo.startsWith("/admin/outlets/")
    ? "/admin/outlets"
    : rawReturnTo;

  return (
    <OutletDetailView
      outlet={outlet}
      brandName={brandName}
      returnTo={returnTo}
    />
  );
}
