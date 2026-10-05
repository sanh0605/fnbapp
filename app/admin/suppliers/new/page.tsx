import { SupplierForm } from "../components/SupplierForm";
import { safeReturnTo, safePoReturnTo } from "../components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default function NewSupplierPage({
  searchParams,
}: {
  searchParams?: { from?: string; name?: string; returnTo?: string };
}) {
  const fromPo = searchParams?.from === "po";
  const returnTo = fromPo
    ? safePoReturnTo(searchParams?.returnTo)
    : safeReturnTo(searchParams?.returnTo);
  const label = fromPo ? "Phiếu nhập" : "Nhà cung cấp";

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel={label}
        title="Thêm nhà cung cấp"
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
