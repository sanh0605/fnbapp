"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { voidOrderV2 } from "./actions";
import OrderDetailModal from "./OrderDetailModal";
import OrderEditModal from "./OrderEditModal";
import StickyFilterBar from "@/components/StickyFilterBar";
import { formatDateTime } from "@/lib/datetime";

import type { OrderListItem } from "./actions";

type OrderLine = OrderListItem["lines"][0];
type Order = OrderListItem;

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const parseDateParam = (value: string | null): Date | null => {
    if (!value) return null;
    if (value.includes("T")) return new Date(value);
    return new Date(`${value}T00:00:00`);
  };

  const toDateOnlyForUrl = (date: Date | null): string => {
    if (!date) return "";
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const [currentPage, setCurrentPage] = useState<number>(() => {
    const val = searchParams.get("page");
    return val ? parseInt(val, 10) || 1 : 1;
  });

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return searchParams.get("q") || "";
  });
  const [startDate, setStartDate] = useState<Date | null>(() => {
    return parseDateParam(searchParams.get("from"));
  });
  const [endDate, setEndDate] = useState<Date | null>(() => {
    return parseDateParam(searchParams.get("to"));
  });
  const [paymentFilter, setPaymentFilter] = useState<string>(() => {
    return searchParams.get("payment") || "";
  });
  const [brandFilter, setBrandFilter] = useState<string>(() => {
    return searchParams.get("brand") || "";
  });

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Sync URL changes back to local states (handles back/forward navigation)
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const payment = searchParams.get("payment") || "";
    const brand = searchParams.get("brand") || "";
    const pageVal = searchParams.get("page");
    const page = pageVal ? parseInt(pageVal, 10) || 1 : 1;
    const from = parseDateParam(searchParams.get("from"));
    const to = parseDateParam(searchParams.get("to"));

    if (q !== searchQuery) setSearchQuery(q);
    if (payment !== paymentFilter) setPaymentFilter(payment);
    if (brand !== brandFilter) setBrandFilter(brand);
    if (page !== currentPage) setCurrentPage(page);

    const fromTime = from ? from.getTime() : 0;
    const startTime = startDate ? startDate.getTime() : 0;
    if (fromTime !== startTime) setStartDate(from);

    const toTime = to ? to.getTime() : 0;
    const endTime = endDate ? endDate.getTime() : 0;
    if (toTime !== endTime) setEndDate(to);
  }, [searchParams]);

  const handleFilterChange = (updates: {
    page?: number;
    q?: string;
    from?: Date | null;
    to?: Date | null;
    payment?: string;
    brand?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.q !== undefined) {
      if (updates.q) params.set("q", updates.q);
      else params.delete("q");
      setSearchQuery(updates.q);
    }
    if (updates.payment !== undefined) {
      if (updates.payment) params.set("payment", updates.payment);
      else params.delete("payment");
      setPaymentFilter(updates.payment);
    }
    if (updates.brand !== undefined) {
      if (updates.brand) params.set("brand", updates.brand);
      else params.delete("brand");
      setBrandFilter(updates.brand);
    }
    if (updates.from !== undefined) {
      if (updates.from) params.set("from", toDateOnlyForUrl(updates.from));
      else params.delete("from");
      setStartDate(updates.from);
    }
    if (updates.to !== undefined) {
      if (updates.to) params.set("to", toDateOnlyForUrl(updates.to));
      else params.delete("to");
      setEndDate(updates.to);
    }

    let targetPage = 1;
    if (updates.page !== undefined) {
      targetPage = updates.page;
    } else {
      const isFilterChange =
        updates.q !== undefined ||
        updates.payment !== undefined ||
        updates.brand !== undefined ||
        updates.from !== undefined ||
        updates.to !== undefined;
      if (!isFilterChange) {
        const pageVal = params.get("page");
        targetPage = pageVal ? parseInt(pageVal, 10) || 1 : 1;
      }
    }

    if (targetPage === 1) {
      params.delete("page");
      setCurrentPage(1);
    } else {
      params.set("page", String(targetPage));
      setCurrentPage(targetPage);
    }

    if (updates.q !== undefined) {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } else {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

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
    const reasonToSend = voidReason;
    setOrderToVoid(null);
    setVoidReason("");
    const res = await voidOrderV2(orderId, reasonToSend);
    if (!res.success) {
      alert("Lỗi hủy đơn: " + res.error);
      return;
    }
    // Update local state immediately; no page reload needed.
    setOrders(prev =>
      prev.map(o => o.id === orderId ? { ...o, status: "VOIDED" } : o)
    );
  };

  const handleEditSave = () => {
    setEditingOrder(null);
    setSelectedOrder(null);
    // Soft refresh to get updated data from server (edit creates a new row)
    router.refresh();
  };

  const clearFilters = () => {
    handleFilterChange({
      q: "",
      from: null,
      to: null,
      payment: "",
      brand: "",
      page: 1,
    });
  };

  const hasActiveFilters = searchQuery || startDate || endDate || paymentFilter || brandFilter;

  // Claude code — UI-1/UI-11: use shared datetime helper, drop seconds in table cell.
  const formatDate = (dateString: string) => formatDateTime(dateString);

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
        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Tìm mã đơn</label>
          <input
            type="text"
            placeholder="VD: PHD000001"
            value={searchQuery}
            onChange={(e) => { handleFilterChange({ q: e.target.value }); }}
            className="w-full md:w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Từ ngày</label>
          <CustomDatePicker
            selected={startDate}
            onChange={(date: Date | null) => { handleFilterChange({ from: date }); }}
            className="w-full md:w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Đến ngày</label>
          <CustomDatePicker
            selected={endDate}
            onChange={(date: Date | null) => { handleFilterChange({ to: date }); }}
            className="w-full md:w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">PT thanh toán</label>
          <select
            value={paymentFilter}
            onChange={(e) => { handleFilterChange({ payment: e.target.value }); }}
            className="w-full md:w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="">Tất cả</option>
            <option value="Tien mat">Tiền mặt</option>
            <option value="Chuyen khoan">Chuyển khoản</option>
          </select>
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Thương hiệu</label>
          <select
            value={brandFilter}
            onChange={(e) => { handleFilterChange({ brand: e.target.value }); }}
            className="w-full md:w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          >
            <option value="">Tất cả</option>
            {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </StickyFilterBar>

      {/* Desktop Table - hidden on mobile, shown on desktop */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hidden md:block">
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
      </div>

      {/* Mobile Card List - shown on mobile, hidden on desktop */}
      <div className="space-y-3 md:hidden">
        {currentOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500">
            Không tìm thấy đơn hàng nào
          </div>
        ) : (
          currentOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-3 active:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold text-gray-900 text-sm">
                    {order.display_order_no || order.order_no}
                  </span>
                  {order.parent_order_id && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-100 text-purple-800">
                      v{order.version}
                    </span>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-orange-600 text-sm">
                    {Number(order.net_total || 0).toLocaleString("vi-VN")} đ
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${order.method === 'Chuyen khoan' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {order.method === "Chuyen khoan" ? "Chuyển khoản" : "Tiền mặt"}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-2 space-y-1">
                {order.lines && order.lines.map((line: OrderLine, idx: number) => (
                  <div key={idx} className="text-xs text-gray-600">
                    <span className="font-bold text-gray-800">{line.qty}x</span> {line.product_name} <span className="text-gray-400">({line.size_name})</span>
                    {line.modifiers && line.modifiers.length > 0 && (
                      <div className="text-[10px] text-gray-500 ml-4 mt-0.5">
                        + {line.modifiers.map((m: any) => m.name).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-50">
                <button
                  onClick={(e) => { e.stopPropagation(); setOrderToVoid(order); }}
                  disabled={order.status !== "COMPLETED"}
                  className="text-xs text-red-600 bg-red-50 hover:bg-red-100 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  Hủy đơn
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Wrapper */}
      {totalPages > 1 && (
        <div className="bg-gray-50 rounded-xl shadow-sm border border-gray-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-gray-500 text-center sm:text-left">
            Hiển thị <span className="font-bold text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> đến <span className="font-bold text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)}</span> trong tổng số <span className="font-bold text-gray-900">{filteredOrders.length}</span> đơn hàng
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleFilterChange({ page: Math.max(1, currentPage - 1) })}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm"
            >
              Trước
            </button>
            <div className="flex items-center px-2 font-medium text-gray-700 text-sm">
              Trang {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => handleFilterChange({ page: Math.min(totalPages, currentPage + 1) })}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm"
            >
              Sau
            </button>
          </div>
        </div>
      )}

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
          onEdit={(freshOrder) => setEditingOrder(freshOrder)}
          onVoid={() => { setOrderToVoid(selectedOrder); setSelectedOrder(null); }}
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
