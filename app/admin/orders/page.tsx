import { getOrders } from "@/app/actions/orders";
import OrderTable from "./OrderTable";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const orders = await getOrders();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Đơn hàng</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý và xem lại tất cả các đơn hàng đã được tạo.</p>
        </div>
        <div className="bg-orange-100 text-orange-700 font-bold px-4 py-2 rounded-lg">
          {orders.length} Đơn hàng
        </div>
      </div>

      <OrderTable initialOrders={orders} />
    </div>
  );
}
