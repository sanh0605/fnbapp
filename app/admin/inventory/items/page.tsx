import { getItemsData } from "./actions";
import ItemsClient from "./components/ItemsClient";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const data = await getItemsData();
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <ItemsClient {...data} />
    </Suspense>
  );
}
