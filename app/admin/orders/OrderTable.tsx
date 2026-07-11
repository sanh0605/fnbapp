"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { voidOrderV2 } from "./actions";
import OrderDetailModal from "./OrderDetailModal";
import OrderEditModal from "./OrderEditModal";
import StickyFilterBar from "@/components/StickyFilterBar";
import { formatDateTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AlertCircle, X } from "lucide-react";

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
  const [voidError, setVoidError] = useState<string | null>(null);

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
    setVoidError(null);
    if (!orderToVoid || !voidReason.trim()) return;
    const orderId = orderToVoid.id;
    const reasonToSend = voidReason;
    
    const res = await voidOrderV2(orderId, reasonToSend);
    if (!res.success) {
      setVoidError("Lỗi hủy đơn: " + res.error);
      return;
    }
    // Update local state immediately; no page reload needed.
    setOrderToVoid(null);
    setVoidReason("");
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
        <Button
          variant="ghost" size="sm" className="!text-danger hover:!bg-red-50"
          onClick={clearFilters}
        >
          Xóa bộ lọc
        </Button>
      )}
      <div className="text-xs font-bold text-text-secondary whitespace-nowrap px-3 py-1.5 bg-surface-secondary rounded-lg">
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
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm mã đơn</label>
          <input
            type="text"
            placeholder="VD: PHD000001"
            value={searchQuery}
            onChange={(e) => { handleFilterChange({ q: e.target.value }); }}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary outline-none shadow-sm"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Từ ngày</label>
          <CustomDatePicker
            selected={startDate}
            onChange={(date: Date | null) => { handleFilterChange({ from: date }); }}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary outline-none shadow-sm"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Đến ngày</label>
          <CustomDatePicker
            selected={endDate}
            onChange={(date: Date | null) => { handleFilterChange({ to: date }); }}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary outline-none shadow-sm"
          />
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">PT thanh toán</label>
          <select
            value={paymentFilter}
            onChange={(e) => { handleFilterChange({ payment: e.target.value }); }}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary shadow-sm"
          >
            <option value="">Tất cả</option>
            <option value="Tien mat">Tiền mặt</option>
            <option value="Chuyen khoan">Chuyển khoản</option>
          </select>
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Thương hiệu</label>
          <select
            value={brandFilter}
            onChange={(e) => { handleFilterChange({ brand: e.target.value }); }}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary shadow-sm"
          >
            <option value="">Tất cả</option>
            {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </StickyFilterBar>

      {/* Desktop Table - hidden on mobile, shown on desktop */}
      <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-text-secondary">
            <thead className="bg-page border-b border-border text-text-secondary font-medium">
              <tr>
                <th className="px-6 py-4">Mã Đơn</th>
                <th className="px-6 py-4">Thời gian</th>
                <th className="px-6 py-4">Sản phẩm (Chi tiết)</th>
                <th className="px-6 py-4 text-right">Tổng tiền</th>
                <th className="px-6 py-4 text-center">Phương thức</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {currentOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-text-muted">
                    Không tìm thấy đơn hàng nào
                  </td>
                </tr>
              ) : (
                currentOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={`hover:bg-page transition-colors cursor-pointer`}
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-6 py-4 font-bold text-text-primary">
                      {order.display_order_no || order.order_no}
                      {order.parent_order_id && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary-soft text-primary">
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
                          <div key={idx} className="text-xs text-text-secondary">
                            <span className="font-bold text-text-primary">{line.qty}x</span> {line.product_name} <span className="text-text-muted">({line.size_name})</span>
                            {line.modifiers && line.modifiers.length > 0 && (
                              <div className="text-[10px] text-text-muted ml-4 mt-0.5">
                                + {line.modifiers.map((m: any) => m.name).join(", ")}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-primary">
                      {formatNumber(order.net_total)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {order.method === "Chuyen khoan" ? (
                        <Badge variant="neutral">Chuyển khoản</Badge>
                      ) : (
                        <Badge variant="success">Tiền mặt</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="!text-danger hover:!bg-red-50"
                        onClick={(e) => { e.stopPropagation(); setOrderToVoid(order); }}
                        disabled={order.status !== "COMPLETED"}
                      >
                        Hủy đơn
                      </Button>
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
          <div className="bg-surface-card rounded-card border border-border p-8 text-center text-text-muted">
            Không tìm thấy đơn hàng nào
          </div>
        ) : (
          currentOrders.map((order) => (
            <div
              key={order.id}
              className="bg-surface-card rounded-card border border-border p-4 shadow-sm space-y-3 active:bg-page transition-colors cursor-pointer"
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-bold text-text-primary text-sm">
                    {order.display_order_no || order.order_no}
                  </span>
                  {order.parent_order_id && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-primary-soft text-primary">
                      v{order.version}
                    </span>
                  )}
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {formatDate(order.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary text-sm">
                    {formatNumber(order.net_total)}
                  </div>
                  <div className="mt-1">
                    {order.method === "Chuyen khoan" ? (
                      <Badge variant="neutral">Chuyển khoản</Badge>
                    ) : (
                      <Badge variant="success">Tiền mặt</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-2 space-y-1">
                {order.lines && order.lines.map((line: OrderLine, idx: number) => (
                  <div key={idx} className="text-xs text-text-secondary">
                    <span className="font-bold text-text-primary">{line.qty}x</span> {line.product_name} <span className="text-text-muted">({line.size_name})</span>
                    {line.modifiers && line.modifiers.length > 0 && (
                      <div className="text-[10px] text-text-muted ml-4 mt-0.5">
                        + {line.modifiers.map((m: any) => m.name).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="!text-danger hover:!bg-red-50"
                  onClick={(e) => { e.stopPropagation(); setOrderToVoid(order); }}
                  disabled={order.status !== "COMPLETED"}
                >
                  Hủy đơn
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Wrapper */}
      {totalPages > 1 && (
        <div className="bg-page rounded-card shadow-sm border border-border px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-text-secondary text-center sm:text-left">
            Hiển thị <span className="font-bold text-text-primary">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> đến <span className="font-bold text-text-primary">{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)}</span> trong tổng số <span className="font-bold text-text-primary">{filteredOrders.length}</span> đơn hàng
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleFilterChange({ page: Math.max(1, currentPage - 1) })}
              disabled={currentPage === 1}
            >
              Trước
            </Button>
            <div className="flex items-center px-2 font-medium text-text-secondary text-sm">
              Trang {currentPage} / {totalPages}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleFilterChange({ page: Math.min(totalPages, currentPage + 1) })}
              disabled={currentPage === totalPages}
            >
              Sau
            </Button>
          </div>
        </div>
      )}

      {/* Void Confirmation Modal */}
      {orderToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-card w-full max-w-sm rounded-card shadow-xl flex flex-col overflow-hidden">
            <div className="p-5 border-b border-border bg-red-50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 text-danger flex items-center justify-center shrink-0"><AlertCircle className="w-5 h-5"/></div>
              <div>
                <h3 className="font-bold text-danger">Hủy đơn hàng</h3>
                <p className="text-sm text-danger font-medium">{orderToVoid.display_order_no}</p>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-text-secondary text-sm">
                Đơn sẽ chuyển sang trạng thái VOIDED. Nguyên liệu sẽ được hoàn trả vào kho. Lịch sử đơn được giữ nguyên.
              </p>
              {voidError && (
                <div role="alert" aria-live="polite" className="p-3 bg-red-50 text-danger text-sm rounded-lg border border-red-200 flex justify-between">
                  <span>{voidError}</span>
                  <button onClick={() => setVoidError(null)} className="ml-2 text-danger hover:opacity-80" aria-label="Đóng"><X className="w-4 h-4"/></button>
                </div>
              )}
              <textarea
                placeholder="Lý do hủy đơn (bắt buộc)"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary"
              />
            </div>
            <div className="p-4 border-t border-border bg-page flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => { setOrderToVoid(null); setVoidReason(""); setVoidError(null); }}
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                className="flex-1 !bg-danger hover:!bg-danger/90"
                onClick={confirmVoid}
                disabled={!voidReason.trim()}
              >
                Đồng ý hủy
              </Button>
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
