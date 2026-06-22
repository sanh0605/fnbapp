"use client";

import { useState, useMemo } from "react";
import { editOrderV2 } from "./actions";
import type { CartInput } from "@/lib/order-cart";
import type { OrderListItem } from "./actions";
import { LineItemEditor } from "./components/LineItemEditor";
import { DiscountEditor } from "./components/DiscountEditor";
import type { EditItem } from "./components/LineItemEditor";

type OrderLine = OrderListItem["lines"][0];
type Order = OrderListItem;



function calcItemTotal(item: EditItem) {
  const modsPrice = item.modifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0);
  const base = (item.unit_price + modsPrice) * item.qty;
  let disc = 0;
  if (item.discount_amount > 0) {
    disc = item.discount_type === "PERCENT" ? (base * item.discount_amount) / 100 : item.discount_amount;
  }
  return Math.max(0, base - disc);
}

function calcItemBaseTotal(item: EditItem) {
  const modsPrice = item.modifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0);
  return (item.unit_price + modsPrice) * item.qty;
}

export default function OrderEditModal({
  order, brands, products, variants, modifiers, categories, onClose, onSave,
}: {
  order: Order;
  brands: any[];
  products: any[];
  variants: any[];
  modifiers: any[];
  categories: any[];
  onClose: () => void;
  onSave: (updatedOrder?: Order) => void;
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
      discount_amount: Number(l.manual_item_discount || 0),
      line_discount: Number(l.promo_discount || 0) + Number(l.order_discount_allocation || 0),
      line_manual_discount: Number(l.manual_item_discount || 0),
      discount_type: "VND",
    }))
  );

  const [orderDiscount, setOrderDiscount] = useState(Number(order.manual_order_discount || 0));
  const [orderDiscountType, setOrderDiscountType] = useState("VND");
  const [paymentMethod, setPaymentMethod] = useState(order.method || "Tien mat");
  const [isSaving, setIsSaving] = useState(false);
  const [editReason, setEditReason] = useState("");

  // Item editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Add product state
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [addCategory, setAddCategory] = useState<string>("ALL");
  const [addSearch, setAddSearch] = useState("");
  const [selectedNewProduct, setSelectedNewProduct] = useState<any>(null);
  const [selectedNewVariant, setSelectedNewVariant] = useState<any>(null);
  const [selectedNewModifiers, setSelectedNewModifiers] = useState<any[]>([]);
  const [newQty, setNewQty] = useState(1);

  const groupedModifiers = useMemo(() => {
    const groups: Record<string, any[]> = {};
    modifiers.forEach((m: any) => {
      if (!groups[m.group_name]) groups[m.group_name] = [];
      groups[m.group_name].push(m);
    });
    return groups;
  }, [modifiers]);

  const filteredAddProducts = useMemo(() => {
    let list = products;
    if (addCategory !== "ALL") list = list.filter((p: any) => p.category_id === addCategory);
    if (addSearch) {
      const q = addSearch.toLowerCase();
      list = list.filter((p: any) => p.name?.toLowerCase().includes(q));
    }
    return list;
  }, [products, addCategory, addSearch]);

  const calculateSubtotal = () => items.reduce((sum, item) => sum + calcItemTotal(item), 0);
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    let orderLevelDisc = 0;
    if (orderDiscount > 0) {
      orderLevelDisc = orderDiscountType === "PERCENT" ? (subtotal * orderDiscount) / 100 : orderDiscount;
    }
    // Subtract promo portion (preserved per-line, NOT order-level)
    const productLevelDisc = items.reduce((sum, item) => sum + Number(item.line_discount || 0), 0);
    return Math.max(0, subtotal - orderLevelDisc - productLevelDisc);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };



  const addNewModifier = (mod: any) => {
    setSelectedNewModifiers([...selectedNewModifiers, { id: mod.id, name: mod.name, price: Number(mod.price || 0) }]);
  };

  const removeNewModifier = (mod: any) => {
    const idx = selectedNewModifiers.findIndex((m: any) => m.id === mod.id);
    if (idx !== -1) {
      setSelectedNewModifiers(selectedNewModifiers.filter((_: any, i: number) => i !== idx));
    }
  };

  const confirmAddProduct = () => {
    if (!selectedNewProduct || !selectedNewVariant) return;
    setItems([...items, {
      product_id: selectedNewProduct.id,
      product_name: selectedNewProduct.name,
      variant_id: selectedNewVariant.id,
      size_name: selectedNewVariant.size_name,
      unit_price: Number(selectedNewVariant.price),
      qty: newQty,
      modifiers: [...selectedNewModifiers],
      discount_amount: 0,
      line_discount: 0,
      line_manual_discount: 0,
      discount_type: "VND",
    }]);
    setIsAddingProduct(false);
    setSelectedNewProduct(null);
    setSelectedNewVariant(null);
    setSelectedNewModifiers([]);
    setNewQty(1);
    setAddSearch("");
    setAddCategory("ALL");
  };

  const handleSave = async () => {
    if (items.length === 0) return;
    if (!editReason.trim()) {
      alert("Lý do chỉnh sửa là bắt buộc");
      return;
    }
    setIsSaving(true);

    const cartInput: CartInput = {
      brand_id: order.brand_id,
      items: items.map(item => {
        let manualItemValue = item.discount_amount;
        let manualItemType: "VND" | "PERCENT" = item.discount_type === "PERCENT" ? "PERCENT" : "VND";
        return {
          product_id: item.product_id,
          variant_id: item.variant_id,
          qty: item.qty,
          modifiers: item.modifiers.map(m => ({ modifier_id: m.id, modifier_qty: 1 })),
          manual_item_discount: { value: manualItemValue, type: manualItemType },
        };
      }),
      payment_method: paymentMethod === "Chuyen khoan" ? "BANK_TRANSFER" : "CASH",
      manual_order_discount: orderDiscount > 0
        ? { value: orderDiscount, type: orderDiscountType === "PERCENT" ? "PERCENT" : "VND" }
        : null,
      actor: { id: "", name: "" }, // server resolves from session
    };

    const res = await editOrderV2({
      orderId: order.id,
      expectedVersion: order.version,
      cart: cartInput,
      reason: editReason,
    });

    setIsSaving(false);

    if (res.success) {
      onSave(order);  // parent will reload
    } else {
      alert("Lỗi cập nhật đơn: " + res.error);
    }
  };



  const totalAmount = calculateTotal();

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 bg-indigo-50 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Sửa đơn hàng</h3>
            <p className="text-sm text-gray-500">{order.display_order_no || order.order_no}</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="p-1.5 bg-gray-200 rounded-full text-gray-500 hover:bg-gray-300 disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 && !isAddingProduct && (
            <div className="text-center text-gray-400 py-8">Không có món nào trong đơn</div>
          )}

          {items.map((item, idx) => (
            <LineItemEditor
              key={idx}
              item={item}
              idx={idx}
              isEditing={editingIndex === idx}
              variants={variants}
              groupedModifiers={groupedModifiers}
              onStartEdit={(i) => setEditingIndex(i)}
              onCancelEdit={() => setEditingIndex(null)}
              onSaveEdit={(i, updatedFields) => {
                setItems(items.map((it, idxIt) => {
                  if (idxIt !== i) return it;
                  return { ...it, ...updatedFields } as EditItem;
                }));
                setEditingIndex(null);
              }}
              onRemove={(i) => {
                setItems(items.filter((_, idxIt) => idxIt !== i));
                if (editingIndex === i) setEditingIndex(null);
              }}
            />
          ))}

          {/* Add Product Section */}
          {isAddingProduct ? (
            <div className="bg-emerald-50 p-3 rounded-xl border-2 border-emerald-200 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-700">Thêm sản phẩm</span>
                <button onClick={() => { setIsAddingProduct(false); setSelectedNewProduct(null); setSelectedNewVariant(null); setSelectedNewModifiers([]); setNewQty(1); }} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {!selectedNewProduct ? (
                <>
                  {/* Search */}
                  <input type="text" placeholder="Tìm sản phẩm..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-1 focus:ring-emerald-500" />

                  {/* Category filter */}
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setAddCategory("ALL")} className={`px-2.5 py-1 rounded-full text-xs font-medium ${addCategory === "ALL" ? "bg-emerald-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>Tất cả</button>
                    {categories.map((c: any) => (
                      <button key={c.id} onClick={() => setAddCategory(c.id)} className={`px-2.5 py-1 rounded-full text-xs font-medium ${addCategory === c.id ? "bg-emerald-600 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>{c.name}</button>
                    ))}
                  </div>

                  {/* Product grid */}
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {filteredAddProducts.map((p: any) => (
                      <button key={p.id} onClick={() => { setSelectedNewProduct(p); setSelectedNewVariant(null); }} className="p-2 rounded-lg border border-gray-200 bg-white hover:border-emerald-400 text-center transition-colors">
                        <div className="text-sm font-medium text-gray-800 truncate">{p.name}</div>
                      </button>
                    ))}
                    {filteredAddProducts.length === 0 && (
                      <div className="col-span-3 text-center text-gray-400 text-sm py-4">Không tìm thấy sản phẩm</div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Selected product detail */}
                  <div className="font-bold text-gray-800">{selectedNewProduct.name}</div>

                  {/* Variant selection */}
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1.5">Size</div>
                    <div className="flex flex-wrap gap-2">
                      {variants.filter((v: any) => v.product_id === selectedNewProduct.id).map((v: any) => (
                        <button key={v.id} onClick={() => setSelectedNewVariant(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedNewVariant?.id === v.id ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-600"
                          }`}>
                          {v.size_name} - {Number(v.price).toLocaleString("vi-VN")}d
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Modifier selection */}
                  {selectedNewVariant && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1.5">Topping</div>
                      <div className="space-y-2">
                        {Object.entries(groupedModifiers).map(([groupName, mods]) => (
                          <div key={groupName}>
                            <div className="text-[11px] text-gray-400 mb-1">{groupName}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {mods.map((mod: any) => {
                                const count = selectedNewModifiers.filter((m: any) => m.id === mod.id).length;
                                return (
                                  <div key={mod.id} className={`flex items-center gap-1 rounded-lg border text-xs ${count > 0 ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-white"
                                    }`}>
                                    {count > 0 && (
                                      <button onClick={() => removeNewModifier(mod)} className="px-1.5 py-1 text-emerald-400 hover:text-red-500 font-bold">-</button>
                                    )}
                                    <span className="px-1 py-1">{mod.name} <span className="text-gray-400">+{Number(mod.price).toLocaleString("vi-VN")}d</span></span>
                                    {count > 0 && <span className="px-1 py-1 font-bold text-emerald-600">{count}x</span>}
                                    <button onClick={() => addNewModifier(mod)} className="px-1.5 py-1 text-gray-400 hover:text-emerald-600 font-bold">+</button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Qty + price summary */}
                  {selectedNewVariant && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">SL:</span>
                        <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                          <button onClick={() => setNewQty(Math.max(1, newQty - 1))} className="w-7 h-7 flex items-center justify-center bg-white rounded border text-gray-600 font-bold">-</button>
                          <span className="font-bold w-6 text-center">{newQty}</span>
                          <button onClick={() => setNewQty(newQty + 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded border text-gray-600 font-bold">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-orange-600">{((Number(selectedNewVariant.price) + selectedNewModifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0)) * newQty).toLocaleString("vi-VN")}d</div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedNewProduct(null); setSelectedNewVariant(null); setSelectedNewModifiers([]); }} className="flex-1 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Quay lại</button>
                    <button onClick={confirmAddProduct} disabled={!selectedNewVariant} className="flex-1 py-1.5 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-40">Thêm vào đơn</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button onClick={() => setIsAddingProduct(true)} className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50 transition-colors">
              + Thêm sản phẩm
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 shrink-0">
          <div className="px-4 py-3 bg-gray-50 space-y-3">
            <DiscountEditor
              orderDiscount={orderDiscount}
              orderDiscountType={orderDiscountType}
              setOrderDiscount={setOrderDiscount}
              setOrderDiscountType={setOrderDiscountType}
            />
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 w-28">Thanh toán:</span>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white outline-none focus:ring-1 focus:ring-indigo-500">
                <option value="Tien mat">Tiền mặt</option>
                <option value="Chuyen khoan">Chuyển khoản</option>
              </select>
            </div>
          </div>

          <div className="px-4 py-2 flex justify-between items-center bg-white border-t border-gray-100">
            <span className="font-bold text-gray-700">Tổng cộng</span>
            <span className="text-xl font-black text-orange-600">{totalAmount.toLocaleString("vi-VN")}đ</span>
          </div>

          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <label className="block text-xs font-bold text-gray-700 mb-1.5">Lý do chỉnh sửa (bắt buộc)</label>
            <textarea
              placeholder="VD: Khách đổi từ 1 ly thành 2 ly"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="px-4 py-3 flex gap-3 bg-white">
            <button onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50">Hủy</button>
            <button onClick={handleSave} disabled={isSaving || items.length === 0 || !editReason.trim()} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}