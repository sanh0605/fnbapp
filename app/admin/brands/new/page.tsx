import { BrandForm } from "@/app/admin/brands/components/BrandForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewBrandPage(
  props: {
    searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
  }
) {
  const searchParams = await props.searchParams;
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined, "/admin/brands");
  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Thương hiệu"
        title="Tạo thương hiệu"
        subtitle="Thêm thương hiệu mới vào hệ thống."
      />
      <BrandForm returnTo={returnTo} />
    </DetailFrame>
  );
}
