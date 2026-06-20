import { getSemiProductsData } from "./actions";
import SemiProductsClient from "./components/SemiProductsClient";

export const dynamic = "force-dynamic";

export default async function SemiProductsPage() {
  const data = await getSemiProductsData();
  return <SemiProductsClient {...data} />;
}
