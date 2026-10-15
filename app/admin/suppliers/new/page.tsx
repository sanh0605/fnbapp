import { SupplierForm } from "../components/SupplierForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { safePoReturnTo } from "../components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function NewSupplierPage(
  props: {
    searchParams?: Promise<{ from?: string; name?: string; returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const fromPo = searchParams?.from === "po";
  const returnTo = fromPo
    ? safePoReturnTo(searchParams?.returnTo)
    : safeReturnTo(searchParams?.returnTo, "/admin/suppliers");
  const label = fromPo ? "Phiếu nhập" : "Nhà cung cấp";

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel={label}
        title="Tạo nhà cung cấp"
        subtitle="Thông tin liên hệ của đối tác cung ứng."
      />
      <SupplierForm
        returnTo={returnTo}
        returnMode={fromPo ? "po" : "list"}
        initialName={searchParams?.name}
      />
    </DetailFrame>
  );
}
