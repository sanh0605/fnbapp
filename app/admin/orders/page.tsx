import { getOrdersV2 } from "./actions";
import OrderTable from "./OrderTable";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { orders, brands, products, variants, modifiers, categories } = await getOrdersV2();

  return (
    <div className="space-y-6">
      <OrderTable
        initialOrders={orders as any}
        brands={brands}
        products={products}
        variants={variants}
        modifiers={modifiers}
        categories={categories}
      />
    </div>
  );
}
