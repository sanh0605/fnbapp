import { notFound, redirect } from "next/navigation";
import { getStocktakeDetail } from "@/app/admin/inventory/stocktake/actions";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { StocktakeEditForm } from "./components/StocktakeEditForm";

export const dynamic = "force-dynamic";

export default async function StocktakeEditPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const detail = await getStocktakeDetail(params.id);
  if (!detail) {
    notFound();
  }
  if (detail.editBlock !== null) {
    redirect(`/admin/inventory/stocktake/${encodeURIComponent(detail.id)}`);
  }

  return (
    <div className="space-y-6">
      <DetailHeader
        backHref={`/admin/inventory/stocktake/${encodeURIComponent(detail.id)}`}
        backLabel={detail.id}
        title="Chỉnh sửa"
        subtitle={detail.id}
      />
      <StocktakeEditForm detail={detail} />
    </div>
  );
}
