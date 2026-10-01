import { getConversionsData } from "../actions";
import { ConversionForm } from "../components/ConversionForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function NewConversionPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/conversions");
  const { items, conversions, units } = await getConversionsData();

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Bảng quy đổi" />
      <PageHeader
        title="Thêm Quy Đổi Mới"
        subtitle="Thiết lập tỷ lệ quy đổi từ đơn vị mua hàng sang đơn vị cơ bản dùng trong pha chế."
      />
      <ConversionForm
        items={items}
        conversions={conversions}
        units={units}
        returnTo={returnTo}
      />
    </div>
  );
}
