"use client";

import { useState, useMemo } from "react";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { voidOrderV2 } from "@/app/actions/orders-v2";
import OrderDetailModal from "./OrderDetailModal";
import OrderEditModal from "./OrderEditModal";
import StickyFilterBar from "@/components/StickyFilterBar";

interface OrderLine {
  id: string;
  product_id: string;
  variant_id: string;
  product_name: string;
  size_name: string;
  qty: number;
  unit_price: number;
  gross_line_total: number;
  promo_discount: number;
  manual_item_discount: number;
  order_discount_allocation: number;
  net_line_total: number;
  modifiers: any[];
}

interface Order {
  id: string;
  order_no: string;
  display_order_no: string;
  brand_id: string;
  status: string;
  version: number;
  parent_order_id: string;
  gross_total: number;
  promo_discount_total: number;
  manual_item_discount_total: number;
  manual_order_discount: number;
  net_total: number;
  method: string;
  created_by_name: string;
  created_at: string;
  lines: OrderLine[];
}

interface Brand {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  size_name: string;
}

interface Modifier {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

export default function OrderTable({
  initialOrders, brands, products, variants, modifiers, categories
}: {
  initialOrders: Order[];
  brands: Brand[];
  products: Product[];
  variants: Variant[];
  modifiers: Modifier[];
  categories: Category[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
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
  const currentOrders = useMemo(() => 
    filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filteredOrders, currentPage]
  );

  const confirmVoid = async () => {
    if (!orderToVoid || !voidReason.trim()) return;
    const orderId = orderToVoid.id;
    setOrderToVoid(null);
    const res = await voidOrderV2(orderId, voidReason);
    setVoidReason("");
    if (!res.success) {
      alert("Lỗi hủy đơn: " + res.error);
      return;
    }
    // Reload to reflect changes
    window.location.reload();
  };

  const handleEditSave = () => {
    setEditingOrder(null);
    setSelectedOrder(null);
    // Reload since V2 edit creates a new row
    window.location.reload();
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStartDate(null);
    setEndDate(null);
    setPaymentFilter("");
    setBrandFilter("");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || startDate || endDate || paymentFilter || brandFilter;

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const rightContent = (
    <>
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition whitespace-nowrap"
        >
          Xóa bộ lọc
        </button>
      )}
      <div className="text-xs font-bold text-gray-500 whitespace-nowrap px-3 py-1.5 bg-gray-100 rounded-lg">
        {filteredOrders.length} / {orders.length}
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <StickyFilterBar 
        rightContent={rightContent}
        title="Quản lý Đơn hàng"
        subtitle="Quản lý và xem lại tất cả các đơn hàng đã được tạo."
      >
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm mã đơn</label>
          <input
            type="text"
            placeholder="VD: PHD000001"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Từ ngày</label>
          <CustomDatePicker
            selected={startDate}
            onChange={(date: Date | null) => { setStartDate(date); setCurrentPage(1); }}
            className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Đến ngày</label>
          <CustomDatePicker
            selected={endDate}
            onChange={(date: Date | null) => { setEndDate(date); setCurrentPage(1); }}
            className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">PT thanh toán</label>
          <select
            value={paymentFilter}
            onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1); }}
            className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="">Tất cả</option>
            <option value="Tien mat">Tiền mặt</option>
            <option value="Chuyen khoan">Chuyển khoản</option>
          </select>
        </div>
        <div className="shrink-0">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Thương hiệu</label>
          <select
            value={brandFilter}
            onChange={(e) => { setBrandFilter(e.target.value); setCurrentPage(1); }}
            className="w-36 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="">Tất cả</option>
            {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </StickyFilterBar>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
              <tr>
                <th className="px-6 py-4">Mã Đơn</th>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">Sản phẩm (Chi tiết)</th>
                <th className="px-6 py-4 text-right">Tổng tiền</th>
                <th className="px-6 py-4 text-center">Phương thức</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {currentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Không tìm thấy đơn hàng nào
                  </td>
                </tr>
              ) : (
                currentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer`}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {order.display_order_no || order.order_no}
                      {order.parent_order_id && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-800">
                          v{order.version}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {formatDate(order.created_at)}
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
                      {Number(order.net_total || 0).toLocaleString("vi-VN")} đ
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${order.method === 'Chuyen khoan' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {order.method === "Chuyen khoan" ? "Chuyển khoản" : "Tiền mặt"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOrderToVoid(order); }}
                        disabled={order.status !== "COMPLETED"}
                        className="text-red-500 hover:text-red-700 font-medium px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Hủy đơn
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
              Hiển thị <span className="font-bold text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> đến <span className="font-bold text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)}</span> trong tổng số <span className="font-bold text-gray-900">{filteredOrders.length}</span> đơn hàng
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Trước
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

      {/* Void Confirmation Modal */}
      {orderToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-red-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl shrink-0">!</div>
              <div>
                <h3 className="font-bold text-red-800">Hủy đơn hàng</h3>
                <p className="text-sm text-red-600 font-medium">{orderToVoid.display_order_no}</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-gray-600 text-sm">
                Đơn sẽ chuyển sang trạng thái VOIDED. Nguyên liệu sẽ được hoàn trả vào kho. Lịch sử đơn được giữ nguyên.
              </p>
              <textarea
                placeholder="Lý do hủy đơn (bắt buộc)"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => { setOrderToVoid(null); setVoidReason(""); }}
                className="flex-1 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50"
              >
                Hủy bỏ
              </button>
              <button
                onClick={confirmVoid}
                disabled={!voidReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 disabled:opacity-50"
              >
                Đồng ý hủy
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
          onDelete={() => { setOrderToVoid(selectedOrder); setSelectedOrder(null); }}
        />
      )}

      {/* Order Edit Modal */}
      {editingOrder && (
        <OrderEditModal
          order={editingOrder}
          brands={brands}
          products={products}
          variants={variants}
          modifiers={modifiers}
          categories={categories}
          onClose={() => setEditingOrder(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
}
