import { notFound } from "next/navigation";
import { getOutlets } from "@/app/admin/outlets/actions";
import { getBrands } from "@/app/admin/brands/actions";
import { OutletForm } from "@/app/admin/outlets/components/OutletForm";
import { safeReturnTo } from "@/app/admin/outlets/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import type { DBOutlet, DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function EditOutletPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(searchParams?.returnTo);

  const [outlets, brands] = await Promise.all([
    getOutlets() as Promise<DBOutlet[]>,
    getBrands() as Promise<DBBrand[]>,
  ]);
  const outlet = outlets.find((o) => o.id === params.id);

  if (!outlet) {
    notFound();
  }

  const ownDetailPath = `/admin/outlets/${encodeURIComponent(outlet.id)}`;
  const ownDetailPathRaw = `/admin/outlets/${outlet.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/outlets/")
    ? "/admin/outlets"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/outlets/${encodeURIComponent(outlet.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={outlet.name}
        title="Chỉnh sửa"
        subtitle={outlet.name}
      />
      <OutletForm
        initialData={outlet}
        brands={brands}
        outlets={outlets}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
