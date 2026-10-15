import { notFound, redirect } from "next/navigation";
import { getStocktakeDetail } from "@/app/admin/inventory/stocktake/actions";
import { PageHeader } from "@/components/ui/PageHeader";
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
      <PageHeader title={`Sửa phiếu kiểm kê ${detail.id}`} />
      <StocktakeEditForm detail={detail} />
    </div>
  );
}
