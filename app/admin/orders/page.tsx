import { Suspense } from "react";
import { getOrdersV2 } from "./actions";
import OrderTable from "./OrderTable";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { orders, brands, products, variants, modifiers, categories } = await getOrdersV2();

  return (
    <div className="space-y-6">
      <Suspense fallback={<div className="text-text-muted py-8 text-center text-sm font-semibold">Đang tải danh sách đơn hàng...</div>}>
        <OrderTable
          initialOrders={orders as any}
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
