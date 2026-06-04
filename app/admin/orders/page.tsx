import { getOrders } from "@/app/actions/orders";
import { findAll } from "@/lib/sheets_db";
import OrderTable from "./OrderTable";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [orders, brands] = await Promise.all([
    getOrders(),
    findAll("Brands")
  ]);

  const activeBrands = brands.filter((b: any) => b.status !== "DELETED");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quan ly Don hang</h1>
          <p className="text-sm text-gray-500 mt-1">Quan ly va xem lai tat ca cac don hang da duoc tao.</p>
        </div>
        <div className="bg-orange-100 text-orange-700 font-bold px-4 py-2 rounded-lg">
          {orders.length} Don hang
        </div>
      </div>

      <OrderTable initialOrders={orders} brands={activeBrands} />
    </div>
  );
}
