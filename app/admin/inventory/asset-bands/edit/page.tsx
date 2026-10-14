import { getAssetBands } from "../actions";
import { requireAdmin } from "@/lib/auth/auth";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { EditBandsForm } from "./components/EditBandsForm";

export const dynamic = "force-dynamic";

export default async function EditAssetBandsPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    throw new Error(auth.error);
  }

  const bands = await getAssetBands();
  const canRemove = auth.actor.role === "ADMIN";

  const returnTo = safeReturnTo(
    searchParams?.returnTo,
    "/admin/inventory/asset-bands",
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Thời hạn khấu hao"
        title="Sửa khung khấu hao"
        subtitle="Xác định số tháng khấu hao theo đơn giá 1 cái. Sửa khung chỉ áp dụng cho tài sản mua sau đó."
      />
      <EditBandsForm
        bands={bands}
        returnTo={returnTo}
        canRemove={canRemove}
      />
    </DetailFrame>
  );
}
