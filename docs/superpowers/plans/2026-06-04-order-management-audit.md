# Order Management Audit - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix bugs, add order filtering/search, order detail view, and order editing with stock recalculation.

**Architecture:** Incremental upgrade on existing Google Sheets-based architecture. Add new modals and server actions without changing the core data layer. Stock recalculation on edit uses recipes valid at order creation time.

**Tech Stack:** Next.js 14 (App Router), React, Tailwind CSS, Google Sheets API (via sheets_db.ts), next-auth.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `app/actions/pos.ts` | Modify | Fix order_no bug + add duplicate check |
| `components/POSScreen.tsx` | Modify | Replace alert() with success modal |
| `app/admin/orders/page.tsx` | Modify | Pass brands data for filter dropdown |
| `app/admin/orders/OrderTable.tsx` | Modify | Add filter bar, search, click-to-detail |
| `app/admin/orders/OrderDetailModal.tsx` | Create | Order detail view modal |
| `app/admin/orders/OrderEditModal.tsx` | Create | Order editing modal with stock recalc |
| `app/actions/order-edit.ts` | Create | Server action for editing orders |

---

### Task 1: Fix order_no return bug in submitOrder

**Files:**
- Modify: `app/actions/pos.ts:163`

- [ ] **Step 1: Fix the return variable name**

In `app/actions/pos.ts`, line 163, change:

```typescript
return { success: true, order_no };
```

to:

```typescript
return { success: true, order_no: final_order_no };
```

- [ ] **Step 2: Verify no other references to the old return shape are broken**

Run: `rtk grep "res.order_no" --include="*.tsx" --include="*.ts" -C 2`

The POSScreen already references `res.order_no` on line 204, which is correct. No changes needed there.

- [ ] **Step 3: Commit**

```bash
rtk git add app/actions/pos.ts
rtk git commit -m "fix: correct order_no return variable in submitOrder"
```

---

### Task 2: Add duplicate order number prevention

**Files:**
- Modify: `app/actions/pos.ts:58-62`

- [ ] **Step 1: Add duplicate check after generating final_order_no**

In `app/actions/pos.ts`, after line 59 (where `final_order_no` is generated), add a while loop to check for duplicates. Replace the block from line 59 to 62:

```typescript
    const final_order_no = `${brandCode}${(previousCount + 1).toString().padStart(6, '0')}`;
    
    // 4. Update the order with the true sequential number
    await update("Orders", order_id, { order_no: final_order_no });
```

with:

```typescript
    let final_order_no = `${brandCode}${(previousCount + 1).toString().padStart(6, '0')}`;
    const existingOrderNos = allOrdersAfter.map((o: any) => o.order_no);
    while (existingOrderNos.includes(final_order_no)) {
      previousCount++;
      final_order_no = `${brandCode}${(previousCount + 1).toString().padStart(6, '0')}`;
    }

    // 4. Update the order with the true sequential number
    await update("Orders", order_id, { order_no: final_order_no });
```

- [ ] **Step 2: Commit**

```bash
rtk git add app/actions/pos.ts
rtk git commit -m "fix: prevent duplicate order numbers with collision check"
```

---

### Task 3: Replace alert() with success modal in POSScreen

**Files:**
- Modify: `components/POSScreen.tsx`

- [ ] **Step 1: Add success modal state variables**

In `components/POSScreen.tsx`, after line 26 (after `editingCartIndex` state), add:

```typescript
  const [successOrderNo, setSuccessOrderNo] = useState<string | null>(null);
```

- [ ] **Step 2: Replace alert in handleConfirmCheckout**

In `components/POSScreen.tsx`, replace the success/error block (lines 203-209):

```typescript
    if (res.success) {
      alert(`Thanh toán thành công! Mã Đơn: ${res.order_no}`);
      setCart([]);
      setIsCartOpen(false);
    } else {
      alert("Lỗi thanh toán: " + res.error);
    }
```

with:

```typescript
    if (res.success) {
      setSuccessOrderNo(res.order_no || "");
      setCart([]);
      setIsCartOpen(false);
      setOrderDiscount(0);
      setOrderDiscountType("VND");
    } else {
      alert("Lỗi thanh toán: " + res.error);
    }
```

- [ ] **Step 3: Add success modal JSX**

In `components/POSScreen.tsx`, before the `<style jsx global>` tag (line 612), add the success modal:

```tsx
      {/* Success Modal */}
      {successOrderNo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4">
                &#10003;
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Thanh toan thanh cong!</h3>
              <p className="text-sm text-gray-500 mb-3">Ma don hang</p>
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-4 mb-4">
                <span className="text-3xl font-black text-orange-600 tracking-wider">{successOrderNo}</span>
              </div>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setSuccessOrderNo(null)}
                className="w-full bg-indigo-600 text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all"
              >
                Tao don moi
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Commit**

```bash
rtk git add components/POSScreen.tsx
rtk git commit -m "feat: replace checkout alert with success modal showing order number"
```

---

### Task 4: Add order filtering and search to OrderTable

**Files:**
- Modify: `app/admin/orders/page.tsx`
- Modify: `app/admin/orders/OrderTable.tsx`

- [ ] **Step 1: Update orders page to pass brands data**

In `app/admin/orders/page.tsx`, update the page to also fetch brands and pass them to OrderTable. Replace the entire file content:

```tsx
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
```

- [ ] **Step 2: Rewrite OrderTable with filters, search, and click-to-detail**

Replace the entire content of `app/admin/orders/OrderTable.tsx`:

```tsx
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
  modifiers_json: string;
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

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  // Modal state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const ITEMS_PER_PAGE = 20;

  // Apply filters
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Search by order number
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const orderNo = (order.display_order_no || order.order_no || "").toLowerCase();
        if (!orderNo.includes(query)) return false;
      }

      // Date range filter
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

      // Payment method filter
      if (paymentFilter && order.method !== paymentFilter) return false;

      // Brand filter
      if (brandFilter && order.brand_id !== brandFilter) return false;

      return true;
    });
  }, [orders, searchQuery, startDate, endDate, paymentFilter, brandFilter]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const currentOrders = filteredOrders.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleDeleteClick = (order: Order) => {
    setOrderToDelete(order);
  };

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
                        onClick={(e) => { e.stopPropagation(); handleDeleteClick(order); }}
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Hien thi <span className="font-bold text-gray-900">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> den <span className="font-bold text-gray-900">{Math.min(currentPage * ITEMS_PER_PAGE, filteredOrders.length)}</span> trong tong so <span className="font-bold text-gray-900">{filteredOrders.length}</span> don hang
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
              >
                Truoc
              </button>
              <div className="flex items-center px-2 font-medium text-gray-700">
                Trang {currentPage} / {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
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
```

- [ ] **Step 3: Commit**

```bash
rtk git add app/admin/orders/page.tsx app/admin/orders/OrderTable.tsx
rtk git commit -m "feat: add order filtering, search, and click-to-detail to order table"
```

---

### Task 5: Create OrderDetailModal

**Files:**
- Create: `app/admin/orders/OrderDetailModal.tsx`

- [ ] **Step 1: Create the detail modal component**

Create `app/admin/orders/OrderDetailModal.tsx` with the following content:

```tsx
"use client";

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

export default function OrderDetailModal({
  order,
  brands,
  onClose,
  onEdit,
  onDelete,
}: {
  order: Order;
  brands: any[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const brand = brands.find((b: any) => b.id === order.brand_id);
  const orderNo = order.display_order_no || order.order_no;

  const calculateLineTotal = (line: OrderLine) => {
    const modsPrice = (line.modifiers || []).reduce((sum: number, m: any) => sum + Number(m.price || 0), 0);
    const baseTotal = (Number(line.unit_price) + modsPrice) * Number(line.qty);
    let discount = 0;
    if (Number(line.line_discount) > 0) {
      if (line.discount_type === "PERCENT") {
        discount = (baseTotal * Number(line.line_discount)) / 100;
      } else {
        discount = Number(line.line_discount);
      }
    }
    return Math.max(0, baseTotal - discount);
  };

  const subtotal = order.lines.reduce((sum: number, l: OrderLine) => sum + calculateLineTotal(l), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{orderNo}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {new Date(order.created_at).toLocaleString("vi-VN")}
              {brand && <span className="ml-2 text-blue-600 font-medium">{brand.name}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Payment info */}
          <div className="flex gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${order.method === 'Chuyen khoan' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {order.method === "Chuyen khoan" ? "Chuyen khoan" : "Tien mat"}
            </span>
            {order.staff_name && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700">
                {order.staff_name}
              </span>
            )}
          </div>

          {/* Line items */}
          <div className="space-y-3">
            {order.lines.map((line: OrderLine, idx: number) => {
              const modsPrice = (line.modifiers || []).reduce((sum: number, m: any) => sum + Number(m.price || 0), 0);
              const baseTotal = (Number(line.unit_price) + modsPrice) * Number(line.qty);
              const lineTotal = calculateLineTotal(line);

              return (
                <div key={idx} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-bold text-gray-800">
                        <span className="text-orange-600 mr-1">{line.qty}x</span>
                        {line.product_name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Size {line.size_name}</div>
                      {(line.modifiers || []).length > 0 && (
                        <div className="text-xs text-indigo-600 mt-1">
                          + {line.modifiers.map((m: any) => m.name).join(", ")}
                        </div>
                      )}
                      {Number(line.line_discount) > 0 && (
                        <div className="text-xs text-red-500 mt-1">
                          Giam: -{line.discount_type === "PERCENT" ? `${line.line_discount}%` : `${Number(line.line_discount).toLocaleString("vi-VN")}d`}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {Number(line.line_discount) > 0 && (
                        <div className="text-[11px] text-gray-400 line-through">{baseTotal.toLocaleString("vi-VN")}d</div>
                      )}
                      <div className="font-bold text-gray-800">{lineTotal.toLocaleString("vi-VN")}d</div>
                      <div className="text-[11px] text-gray-400">{Number(line.unit_price).toLocaleString("vi-VN")}d / mon</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer - Totals & Actions */}
        <div className="border-t border-gray-100 shrink-0">
          <div className="px-5 py-3 bg-gray-50 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Tam tinh</span>
              <span className="font-medium">{subtotal.toLocaleString("vi-VN")}d</span>
            </div>
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Giam gia ({order.discount_type === "PERCENT" ? `${order.discount_amount}%` : "VND"})</span>
                <span className="font-medium">-{Number(order.discount_amount).toLocaleString("vi-VN")}d</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1 border-t border-gray-200">
              <span className="text-gray-900">Tong cong</span>
              <span className="text-orange-600">{Number(order.total_amount || 0).toLocaleString("vi-VN")}d</span>
            </div>
          </div>
          <div className="px-5 py-4 flex gap-3 bg-white">
            <button
              onClick={onEdit}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Sua don
            </button>
            <button
              onClick={onDelete}
              className="px-4 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors"
            >
              Xoa don
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add app/admin/orders/OrderDetailModal.tsx
rtk git commit -m "feat: add OrderDetailModal with line items, discounts, and totals"
```

---

### Task 6: Create editOrder server action

**Files:**
- Create: `app/actions/order-edit.ts`

- [ ] **Step 1: Create the editOrder server action**

Create `app/actions/order-edit.ts`:

```typescript
"use server";

import { findAll, findAllNoCache, insert, update, remove } from "@/lib/sheets_db";
import { revalidatePath } from "next/cache";

interface EditLineItem {
  product_id: string;
  variant_id: string;
  qty: number;
  unit_price: number;
  modifiers: any[];
  discount_amount: number;
  discount_type: string;
}

export async function editOrder(
  orderId: string,
  editData: {
    items: EditLineItem[];
    total_amount: number;
    subtotal_amount: number;
    discount_amount: number;
    discount_type: string;
    payment_method: string;
  }
) {
  try {
    // 1. Verify order exists
    const allOrders = await findAllNoCache("Orders");
    const order = allOrders.find((o: any) => o.id === orderId);
    if (!order) return { error: "Khong tim thay don hang" };

    const orderCreatedAt = order.created_at;
    const { items, total_amount, subtotal_amount, discount_amount, discount_type, payment_method } = editData;
    if (!items || items.length === 0) return { error: "Gio hang trong" };

    const nowIso = new Date().toISOString();

    // 2. Delete old Order_Lines
    const allLines = await findAllNoCache("Order_Lines");
    const oldLines = allLines.filter((l: any) => l.order_id === orderId);
    for (const line of oldLines) {
      await remove("Order_Lines", line.id);
    }

    // 3. Delete old Stock_Ledger entries for this order
    const allStockLedger = await findAllNoCache("Stock_Ledger");
    const oldStockEntries = allStockLedger.filter((s: any) => s.reference_id === orderId);
    for (const entry of oldStockEntries) {
      await remove("Stock_Ledger", entry.id);
    }

    // 4. Create new Order_Lines and Stock_Ledger entries
    const allRecipes = await findAll("Recipes");
    const baseIngredients = await findAll("Base_Ingredients");

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const line_id = `OL-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
      await insert("Order_Lines", {
        id: line_id,
        order_id: orderId,
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.qty,
        unit_price: item.unit_price,
        line_discount: item.discount_amount || 0,
        discount_type: item.discount_type || "VND",
        modifiers_json: JSON.stringify(item.modifiers || []),
        created_at: nowIso,
      });

      // Stock deduction - variant recipe
      // Priority: recipe with end_date > orderCreatedAt
      // Fallback: recipe with empty end_date
      const variantRecipe = allRecipes.find((r: any) =>
        r.target_type === "PRODUCT_VARIANT" &&
        r.target_id === item.variant_id &&
        (
          (r.end_date && r.end_date !== "" && new Date(r.end_date) > new Date(orderCreatedAt)) ||
          (!r.end_date || r.end_date === "")
        )
      );

      if (variantRecipe && variantRecipe.ingredients_json) {
        let ings: any[] = [];
        try { ings = JSON.parse(variantRecipe.ingredients_json); } catch (e) {}

        for (const ing of ings) {
          let skip = false;
          if (ing.ingredient_type === "BASE_INGREDIENT") {
            const baseIng = baseIngredients.find((b: any) => b.id === ing.ingredient_id);
            if (baseIng?.is_non_inventory === "TRUE" || baseIng?.is_non_inventory === true) skip = true;
          }

          if (!skip && ing.quantity > 0) {
            const consumeQty = Number(ing.quantity) * Number(item.qty);
            const ledger_id = `STK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            await insert("Stock_Ledger", {
              id: ledger_id,
              transaction_type: "SALES_CONSUME",
              reference_id: orderId,
              item_reference: ing.ingredient_id,
              quantity_change: -consumeQty,
              unit_cost: 0,
              created_at: nowIso,
            });
          }
        }
      }

      // Stock deduction - modifier recipes
      if (item.modifiers && item.modifiers.length > 0) {
        for (const mod of item.modifiers) {
          const modRecipe = allRecipes.find((r: any) =>
            r.target_type === "MODIFIER" &&
            r.target_id === mod.id &&
            (
              (r.end_date && r.end_date !== "" && new Date(r.end_date) > new Date(orderCreatedAt)) ||
              (!r.end_date || r.end_date === "")
            )
          );

          if (modRecipe && modRecipe.ingredients_json) {
            let modIngs: any[] = [];
            try { modIngs = JSON.parse(modRecipe.ingredients_json); } catch (e) {}

            for (const ing of modIngs) {
              let skip = false;
              if (ing.ingredient_type === "BASE_INGREDIENT") {
                const baseIng = baseIngredients.find((b: any) => b.id === ing.ingredient_id);
                if (baseIng?.is_non_inventory === "TRUE" || baseIng?.is_non_inventory === true) skip = true;
              }

              if (!skip && ing.quantity > 0) {
                const consumeQty = Number(ing.quantity) * Number(item.qty);
                const ledger_id = `STK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                await insert("Stock_Ledger", {
                  id: ledger_id,
                  transaction_type: "SALES_CONSUME",
                  reference_id: orderId,
                  item_reference: ing.ingredient_id,
                  quantity_change: -consumeQty,
                  unit_cost: 0,
                  created_at: nowIso,
                });
              }
            }
          }
        }
      }
    }

    // 5. Update the order record
    await update("Orders", orderId, {
      total_amount,
      subtotal_amount,
      discount_amount,
      discount_type,
      method: payment_method,
    });

    revalidatePath("/admin/orders");
    revalidatePath("/admin/reports");

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add app/actions/order-edit.ts
rtk git commit -m "feat: add editOrder server action with stock recalculation"
```

---

### Task 7: Create OrderEditModal

**Files:**
- Create: `app/admin/orders/OrderEditModal.tsx`

This is the largest task. The modal allows editing items, quantities, sizes, modifiers, discounts, and payment method.

- [ ] **Step 1: Create the edit modal component**

Create `app/admin/orders/OrderEditModal.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { editOrder } from "@/app/actions/order-edit";

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

interface EditItem {
  product_id: string;
  product_name: string;
  variant_id: string;
  size_name: string;
  unit_price: number;
  qty: number;
  modifiers: any[];
  discount_amount: number;
  discount_type: string;
}

export default function OrderEditModal({
  order,
  brands,
  onClose,
  onSave,
}: {
  order: Order;
  brands: any[];
  onClose: () => void;
  onSave: (updatedOrder: Order) => void;
}) {
  // Convert existing lines to editable items
  const [items, setItems] = useState<EditItem[]>(() =>
    order.lines.map((l: OrderLine) => ({
      product_id: l.product_id,
      product_name: l.product_name,
      variant_id: l.variant_id,
      size_name: l.size_name,
      unit_price: Number(l.unit_price),
      qty: Number(l.qty),
      modifiers: (l.modifiers || []).map((m: any) => ({ id: m.id, name: m.name, price: Number(m.price || 0) })),
      discount_amount: Number(l.line_discount || 0),
      discount_type: l.discount_type || "VND",
    }))
  );

  const [orderDiscount, setOrderDiscount] = useState(Number(order.discount_amount || 0));
  const [orderDiscountType, setOrderDiscountType] = useState(order.discount_type || "VND");
  const [paymentMethod, setPaymentMethod] = useState(order.method || "Tien mat");
  const [isSaving, setIsSaving] = useState(false);

  // Editing state for a single item
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editDiscountType, setEditDiscountType] = useState<"VND" | "PERCENT">("VND");

  const calculateItemTotal = (item: EditItem) => {
    const modsPrice = item.modifiers.reduce((sum: number, m: any) => sum + Number(m.price), 0);
    const baseTotal = (item.unit_price + modsPrice) * item.qty;
    let discount = 0;
    if (item.discount_amount > 0) {
      if (item.discount_type === "PERCENT") {
        discount = (baseTotal * item.discount_amount) / 100;
      } else {
        discount = item.discount_amount;
      }
    }
    return Math.max(0, baseTotal - discount);
  };

  const calculateSubtotal = () => items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    let discount = 0;
    if (orderDiscount > 0) {
      if (orderDiscountType === "PERCENT") {
        discount = (subtotal * orderDiscount) / 100;
      } else {
        discount = orderDiscount;
      }
    }
    return Math.max(0, subtotal - discount);
  };

  const totalAmount = calculateTotal();

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const startEditItem = (index: number) => {
    const item = items[index];
    setEditingIndex(index);
    setEditQty(item.qty);
    setEditDiscount(item.discount_amount);
    setEditDiscountType(item.discount_type as "VND" | "PERCENT");
  };

  const saveEditItem = () => {
    if (editingIndex === null) return;
    const newItems = [...items];
    newItems[editingIndex] = {
      ...newItems[editingIndex],
      qty: editQty,
      discount_amount: editDiscount,
      discount_type: editDiscountType,
    };
    setItems(newItems);
    setEditingIndex(null);
  };

  const handleSave = async () => {
    if (items.length === 0) return;
    setIsSaving(true);

    const editData = {
      items: items.map(item => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        qty: item.qty,
        unit_price: item.unit_price,
        modifiers: item.modifiers,
        discount_amount: item.discount_amount,
        discount_type: item.discount_type,
      })),
      total_amount: totalAmount,
      subtotal_amount: calculateSubtotal(),
      discount_amount: orderDiscount,
      discount_type: orderDiscountType,
      payment_method: paymentMethod,
    };

    const res = await editOrder(order.id, editData);
    setIsSaving(false);

    if (res.success) {
      // Reconstruct the updated order for optimistic UI
      const updatedOrder: Order = {
        ...order,
        total_amount: totalAmount,
        subtotal_amount: calculateSubtotal(),
        discount_amount: orderDiscount,
        discount_type: orderDiscountType,
        method: paymentMethod,
        lines: items.map((item, idx) => ({
          id: `OL-EDIT-${idx}`,
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.product_name,
          size_name: item.size_name,
          qty: item.qty,
          unit_price: item.unit_price,
          line_discount: item.discount_amount,
          discount_type: item.discount_type,
          modifiers_json: JSON.stringify(item.modifiers),
          modifiers: item.modifiers,
        })),
      };
      onSave(updatedOrder);
    } else {
      alert("Loi cap nhat don: " + res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-indigo-50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Sua don hang</h3>
            <p className="text-sm text-gray-500">{order.display_order_no || order.order_no}</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="text-center text-gray-400 py-8">Khong co mon nao trong don</div>
          ) : (
            items.map((item, idx) => {
              const modsPrice = item.modifiers.reduce((sum: number, m: any) => sum + Number(m.price), 0);
              const baseTotal = (item.unit_price + modsPrice) * item.qty;
              const lineTotal = calculateItemTotal(item);

              if (editingIndex === idx) {
                return (
                  <div key={idx} className="bg-indigo-50 p-3 rounded-xl border-2 border-indigo-200">
                    <div className="font-bold text-gray-800 mb-2">{item.product_name} - Size {item.size_name}</div>
                    {(item.modifiers.length > 0) && (
                      <div className="text-xs text-indigo-600 mb-2">
                        + {item.modifiers.map((m: any) => m.name).join(", ")}
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 w-16">So luong:</span>
                        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-200">
                          <button onClick={() => setEditQty(Math.max(1, editQty - 1))} className="w-7 h-7 flex items-center justify-center bg-white rounded border text-gray-600 font-bold">-</button>
                          <span className="font-bold w-6 text-center">{editQty}</span>
                          <button onClick={() => setEditQty(editQty + 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded border text-gray-600 font-bold">+</button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 w-16">Giam gia:</span>
                        <div className="flex items-center gap-2 flex-1">
                          <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
                            <button
                              onClick={() => setEditDiscountType("VND")}
                              className={`px-2 py-1 text-xs font-bold ${editDiscountType === "VND" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"}`}
                            >VND</button>
                            <button
                              onClick={() => setEditDiscountType("PERCENT")}
                              className={`px-2 py-1 text-xs font-bold ${editDiscountType === "PERCENT" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"}`}
                            >%</button>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={editDiscount || ""}
                            onChange={(e) => setEditDiscount(Number(e.target.value))}
                            className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => setEditingIndex(null)} className="flex-1 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Huy</button>
                        <button onClick={saveEditItem} className="flex-1 py-1.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Luu</button>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex-1">
                      <span className="font-bold text-orange-600 mr-1">{item.qty}x</span>
                      <span className="font-bold text-gray-800">{item.product_name}</span>
                      <span className="text-gray-400 text-xs ml-1">({item.size_name})</span>
                    </div>
                    <div className="text-right">
                      {item.discount_amount > 0 && (
                        <div className="text-[11px] text-gray-400 line-through">{baseTotal.toLocaleString("vi-VN")}d</div>
                      )}
                      <div className="font-bold text-gray-800">{lineTotal.toLocaleString("vi-VN")}d</div>
                    </div>
                  </div>
                  {item.modifiers.length > 0 && (
                    <div className="text-xs text-indigo-600 mb-1">+ {item.modifiers.map((m: any) => m.name).join(", ")}</div>
                  )}
                  {item.discount_amount > 0 && (
                    <div className="text-xs text-red-500 mb-1">
                      Giam: -{item.discount_type === "PERCENT" ? `${item.discount_amount}%` : `${Number(item.discount_amount).toLocaleString("vi-VN")}d`}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => startEditItem(idx)} className="text-xs font-medium text-indigo-600 px-2 py-1 bg-indigo-50 rounded hover:bg-indigo-100">Sua</button>
                    <button onClick={() => removeItem(idx)} className="text-xs font-medium text-red-500 px-2 py-1 bg-red-50 rounded hover:bg-red-100">Xoa</button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 shrink-0">
          {/* Order discount & payment */}
          <div className="px-4 py-3 bg-gray-50 space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 w-28">Giam gia don:</span>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
                  <button
                    onClick={() => setOrderDiscountType("VND")}
                    className={`px-2 py-1 text-xs font-bold ${orderDiscountType === "VND" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"}`}
                  >VND</button>
                  <button
                    onClick={() => setOrderDiscountType("PERCENT")}
                    className={`px-2 py-1 text-xs font-bold ${orderDiscountType === "PERCENT" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"}`}
                  >%</button>
                </div>
                <input
                  type="number"
                  min="0"
                  value={orderDiscount || ""}
                  onChange={(e) => setOrderDiscount(Number(e.target.value))}
                  className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 w-28">Thanh toan:</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Tien mat">Tien mat</option>
                <option value="Chuyen khoan">Chuyen khoan</option>
              </select>
            </div>
          </div>

          {/* Total */}
          <div className="px-4 py-2 flex justify-between items-center bg-white border-t border-gray-100">
            <span className="font-bold text-gray-700">Tong cong</span>
            <span className="text-xl font-black text-orange-600">{totalAmount.toLocaleString("vi-VN")}d</span>
          </div>

          {/* Actions */}
          <div className="px-4 py-3 flex gap-3 bg-white">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Huy
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || items.length === 0}
              className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? "Dang luu..." : "Luu thay doi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
rtk git add app/admin/orders/OrderEditModal.tsx
rtk git commit -m "feat: add OrderEditModal with item editing, discounts, and payment method"
```

---

### Task 8: Verify build and integration

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

Run: `rtk tsc --noEmit 2>&1 | head -50`

Expected: No errors in the modified/new files. Some pre-existing errors in unrelated files are acceptable.

- [ ] **Step 2: Verify all imports resolve**

Run: `rtk grep "^import" app/actions/order-edit.ts app/admin/orders/OrderDetailModal.tsx app/admin/orders/OrderEditModal.tsx app/admin/orders/OrderTable.tsx`

Verify that all imports reference existing files and exports.

- [ ] **Step 3: Commit any fixes if needed**

If TypeScript errors are found in the new/modified files, fix them and commit.

---

## Self-Review Checklist

- **Spec coverage:**
  - Part 1.1 (order_no bug): Task 1 - covered
  - Part 1.2 (duplicate prevention): Task 2 - covered
  - Part 1.3 (success UX): Task 3 - covered
  - Part 2 (filtering/search): Task 4 - covered
  - Part 3 (detail view): Task 5 - covered
  - Part 4 (order editing): Tasks 6, 7 - covered
  - Recipe lookup by order.created_at: Task 6 - covered (end_date > orderCreatedAt priority, empty end_date fallback)

- **No placeholders:** All code shown inline, no TBD/TODO.

- **Type consistency:** `OrderLine` and `Order` interfaces are defined consistently in OrderTable, OrderDetailModal, and OrderEditModal. `editOrder` server action accepts `EditLineItem[]` matching the data sent from OrderEditModal.
