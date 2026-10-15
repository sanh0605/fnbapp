import { notFound, redirect } from "next/navigation";
import { getStocktakeDetail } from "@/app/admin/inventory/stocktake/actions";
import { StocktakeDetailView } from "./components/StocktakeDetailView";

export const dynamic = "force-dynamic";

export default async function StocktakeDetailPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const detail = await getStocktakeDetail(params.id);
  if (!detail) {
    notFound();
  }
  if (detail.status === "OPEN") {
    redirect("/admin/inventory/stocktake");
  }

  return <StocktakeDetailView detail={detail} />;
}
