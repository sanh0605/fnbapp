import { notFound } from "next/navigation";
import { getConversionsData } from "../../actions";
import { ConversionForm } from "../../components/ConversionForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { BackLink } from "@/components/ui/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function EditConversionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const returnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/conversions");
  const { items, conversions, units } = await getConversionsData();

  const conv = conversions.find((c) => c.id === params.id);
  if (!conv) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Bảng quy đổi" />
      <PageHeader
        title="Sửa Quy Đổi"
        subtitle="Cập nhật tỷ lệ quy đổi đơn vị mua hàng sang đơn vị cơ bản."
      />
      <ConversionForm
        initialData={conv}
        items={items}
        conversions={conversions}
        units={units}
        returnTo={returnTo}
      />
    </div>
  );
}
