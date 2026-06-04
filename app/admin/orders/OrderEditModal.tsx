"use client";

import { useState } from "react";
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

          <div className="px-4 py-2 flex justify-between items-center bg-white border-t border-gray-100">
            <span className="font-bold text-gray-700">Tong cong</span>
            <span className="text-xl font-black text-orange-600">{totalAmount.toLocaleString("vi-VN")}d</span>
          </div>

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
