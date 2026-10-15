import { Suspense } from "react";
import { getStockOnHand } from "./actions";
import StockOnHandClient from "./components/StockOnHandClient";

export const dynamic = "force-dynamic";

export default async function StockOnHandPage(props: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const searchParams = await props.searchParams;
  const data = await getStockOnHand();
  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <StockOnHandClient
        {...data}
        initialSearch={searchParams?.q ?? ""}
      />
    </Suspense>
  );
}
