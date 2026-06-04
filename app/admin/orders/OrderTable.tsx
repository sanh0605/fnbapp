"use client";

import { useState, useMemo } from "react";
import { deleteOrder } from "@/app/actions/orders";
import OrderDetailModal from "./OrderDetailModal";
import OrderEditModal from "./OrderEditModal";

interface OrderLine {
  id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  size_name: string;
  qty: number;
  unit_price: number;
  line_discount: number;
  discount_type: string;
  modifiers_json?: string;
  modifiers: any[];
}

interface Order {
  id: string;
  order_no: string;
  display_order_no: string;
  brand_id: string;
  total_amount: number;
  subtotal_amount: number;
  discount_amount: number;
  discount_type: string;
  method: string;
  staff_name: string;
  created_at: string;
  lines: OrderLine[];
}

export default function OrderTable({ initialOrders, brands }: { initialOrders: Order[]; brands: any[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const ITEMS_PER_PAGE = 20;

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const orderNo = (order.display_order_no || order.order_no || "").toLowerCase();
        if (!orderNo.includes(query)) return false;
      }
      if (startDate) {
        const orderDate = new Date(order.created_at);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (orderDate < start) return false;
      }
      if (endDate) {
        const orderDate = new Date(order.created_at);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) return false;
      }
      if (paymentFilter && order.method !== paymentFilter) return false;
      if (brandFilter && order.brand_id !== brandFilter) return false;
      return true;
    });
  }, [orders, searchQuery, startDate, endDate, paymentFilter, brandFilter]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const currentOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const confirmDelete = async () => {
    if (!orderToDelete) return;
    const orderId = orderToDelete.id;
    const prevOrders = [...orders];
    setOrders(orders.filter(o => o.id !== orderId));
    setOrderToDelete(null);
    const res = await deleteOrder(orderId);
    if (!res.success) {
      setOrders(prevOrders);
      alert("Loi xoa don: " + res.error);
    }
  };

  const handleEditSave = (updatedOrder: Order) => {
    setOrders(orders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setEditingOrder(null);
    setSelectedOrder(null);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setPaymentFilter("");
    setBrandFilter("");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || startDate || endDate || paymentFilter || brandFilter;

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tim ma don</label>
          <input
            type="text"
            placeholder="VD: PHD000001"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-44 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Tu ngay</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
            className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Den ngay</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
            className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">PT thanh toan</label>
          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1); }}
            className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Tat ca</option>
            <option value="Tien mat">Tien mat</option>
            <option value="Chuyen khoan">Chuyen khoan</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Thuong hieu</label>
          <select
            value={brandFilter}
            onChange={(e) => { setBrandFilter(e.target.value); setCurrentPage(1); }}
            className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Tat ca</option>
            {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
          >
            Xoa bo loc
          </button>
        )}
        <div className="ml-auto text-sm text-gray-500">
          {filteredOrders.length} / {orders.length} don hang
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-4">Ma Don</th>
                <th className="px-6 py-4">Thoi gian</th>
                <th className="px-6 py-4">San pham (Chi tiet)</th>
                <th className="px-6 py-4 text-right">Tong tien</th>
                <th className="px-6 py-4 text-center">Phuong thuc</th>
                <th className="px-6 py-4 text-right">Thao tac</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Khong tim thay don hang nao
                  </td>
                </tr>
              ) : (
                currentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${deletingId === order.id ? "opacity-50" : ""}`}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {order.display_order_no || order.order_no}
                    </td>
                    <td className="px-6 py-4">
                      {new Date(order.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        {order.lines && order.lines.map((line: OrderLine, idx: number) => (
                          <div key={idx} className="text-xs">
                            <span className="font-bold text-gray-700">{line.qty}x</span> {line.product_name} <span className="text-gray-400">({line.size_name})</span>
                            {line.modifiers && line.modifiers.length > 0 && (
                              <div className="text-[10px] text-gray-500 ml-4 mt-0.5">
                                + {line.modifiers.map((m: any) => m.name).join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-orange-600">
                      {Number(order.total_amount || 0).toLocaleString("vi-VN")} d
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${order.method === 'Chuyen khoan' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {order.method === "Chuyen khoan" ? "Chuyen khoan" : "Tien mat"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOrderToDelete(order); }}
                        disabled={deletingId === order.id}
                        className="text-red-500 hover:text-red-700 font-medium px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      >
                        {deletingId === order.id ? "Dang xoa..." : "Xoa don"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Hien thi <span className="font-bold text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> den <span className="font-bold text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)}</span> trong tong so <span className="font-bold text-gray-900">{filteredOrders.length}</span> don hang
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Truoc
              </button>
              <div className="flex items-center px-2 font-medium text-gray-700">
                Trang {currentPage} / {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-red-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl shrink-0">
                !
              </div>
              <div>
                <h3 className="font-bold text-red-800">Xac nhan xoa don</h3>
                <p className="text-sm text-red-600 font-medium">{orderToDelete.display_order_no || orderToDelete.order_no}</p>
              </div>
            </div>
            <div className="p-5 text-gray-600 text-sm leading-relaxed">
              Co chac chan muon xoa don hang nay khong? Xoa se hoan tra toan bo nguyen vat lieu cua don nay vao kho. Thao tac nay khong the hoan tac.
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
              >
                Huy bo
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-sm shadow-red-200 transition-colors"
              >
                Dong y xoa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && !editingOrder && (
        <OrderDetailModal
          order={selectedOrder}
          brands={brands}
          onClose={() => setSelectedOrder(null)}
          onEdit={() => setEditingOrder(selectedOrder)}
          onDelete={() => { setOrderToDelete(selectedOrder); setSelectedOrder(null); }}
        />
      )}

      {/* Order Edit Modal */}
      {editingOrder && (
        <OrderEditModal
          order={editingOrder}
          brands={brands}
          onClose={() => setEditingOrder(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
