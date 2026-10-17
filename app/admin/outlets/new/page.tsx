import { getOutlets } from "@/app/admin/outlets/actions";
import { getBrands } from "@/app/admin/brands/actions";
import { OutletForm } from "@/app/admin/outlets/components/OutletForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import type { DBOutlet, DBBrand } from "@/types/db";

export const dynamic = "force-dynamic";

export default async function NewOutletPage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined, "/admin/outlets");
  const [outlets, brands] = await Promise.all([
    getOutlets() as Promise<DBOutlet[]>,
    getBrands() as Promise<DBBrand[]>,
  ]);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Điểm bán"
        title="Tạo điểm bán"
        subtitle="Thêm điểm bán mới vào hệ thống."
      />
      <OutletForm brands={brands} outlets={outlets} returnTo={returnTo} />
    </DetailFrame>
  );
}
