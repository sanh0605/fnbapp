import { getProductionData } from "./actions";
import ProductionClient from "./components/ProductionClient";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const data = await getProductionData();
  return <ProductionClient {...data} />;
}
