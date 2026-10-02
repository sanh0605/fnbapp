import { notFound } from "next/navigation";
import { getConversionsData } from "../../actions";
import { ConversionForm } from "../../components/ConversionForm";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditConversionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(searchParams?.returnTo, "/admin/inventory/conversions");
  const listReturnTo = rawReturnTo.startsWith("/admin/inventory/conversions/")
    ? "/admin/inventory/conversions"
    : rawReturnTo;

  const { items, conversions, units } = await getConversionsData();

  const conv = conversions.find((c) => c.id === params.id);
  if (!conv) {
    notFound();
  }

  const detailHref = `/admin/inventory/conversions/${encodeURIComponent(conv.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;
  const item = items.find((i) => i.id === conv.purchased_item_id);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={item?.name || conv.id}
        title="Chỉnh sửa"
        subtitle={conv.id}
      />
      <ConversionForm
        initialData={conv}
        items={items}
        conversions={conversions}
        units={units}
        returnTo={detailHref}
      />
    </DetailFrame>
  );
}
