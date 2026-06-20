import { getItemsData } from "./actions";
import ItemsClient from "./components/ItemsClient";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const data = await getItemsData();
  return <ItemsClient {...data} />;
}
