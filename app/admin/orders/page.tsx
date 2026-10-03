import { Suspense } from "react";
import { getOrdersV2 } from "./actions";
import OrderTable from "./OrderTable";
import { toSaigonUtcRange } from "@/lib/shared/report-time";

export const dynamic = "force-dynamic";

// "from"/"to" arrive as date-only (yyyy-mm-dd) from OrderTable's URL sync;
// expand to full-day bounds so a selected day is inclusive on both ends,
// whole days in Asia/Saigon (BR-DATA-006), whatever zone the server runs in.
function toStartOfDayIso(dateOnly: string): string {
  return toSaigonUtcRange(dateOnly, dateOnly)!.startUtc.toISOString();
}
function toEndOfDayIso(dateOnly: string): string {
  return toSaigonUtcRange(dateOnly, dateOnly)!.endUtc.toISOString();
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const getParam = (key: string) => {
    const val = searchParams?.[key];
    return typeof val === "string" ? val : Array.isArray(val) ? val[0] : undefined;
  };

  const page = parseInt(getParam("page") || "1", 10) || 1;
  const q = getParam("q") || undefined;
  const fromParam = getParam("from");
  const toParam = getParam("to");
  const payment = getParam("payment") || undefined;
  const brand = getParam("brand") || undefined;

  const { orders, totalCount, itemsPerPage, brands, products, variants, modifiers, categories } = await getOrdersV2({
    page,
    q,
    from: fromParam ? toStartOfDayIso(fromParam) : undefined,
    to: toParam ? toEndOfDayIso(toParam) : undefined,
    payment,
    brand,
  });

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="text-text-muted py-8 text-center text-sm font-semibold">Đang tải danh sách đơn hàng...</div>}>
        <OrderTable
          initialOrders={orders as any}
          totalCount={totalCount}
          itemsPerPage={itemsPerPage}
          brands={brands}
          products={products}
          variants={variants}
          modifiers={modifiers}
          categories={categories}
        />
      </Suspense>
    </div>
  );
}
