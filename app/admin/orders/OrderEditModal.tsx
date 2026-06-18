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
  discount_amount: number; // Editable manual portion
  line_discount: number; // Preserved promo portion
  line_manual_discount: number; // Preserved manual portion
  discount_type: string;
}

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
      discount_amount: Number((l as any).line_manual_discount || 0),
      line_discount: Number(l.line_discount || 0),
      line_manual_discount: Number((l as any).line_manual_discount || 0),
      discount_type: l.discount_type || "VND",
    }))
  );

  const [orderDiscount, setOrderDiscount] = useState(Number(order.discount_amount || 0));
  const [orderDiscountType, setOrderDiscountType] = useState(order.discount_type || "VND");
  const [paymentMethod, setPaymentMethod] = useState(order.method || "Tien mat");
  const [isSaving, setIsSaving] = useState(false);

  // Item editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editDiscount, setEditDiscount] = useState(0);
  const [editDiscountType, setEditDiscountType] = useState<"VND" | "PERCENT">("VND");
  const [editVariantId, setEditVariantId] = useState<string>("");
  const [editModifiers, setEditModifiers] = useState<any[]>([]);

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

  const startEditItem = (index: number) => {
    const item = items[index];
    setEditingIndex(index);
    setEditQty(item.qty);
    setEditDiscount(item.discount_amount);
    setEditDiscountType(item.discount_type as "VND" | "PERCENT");
    setEditVariantId(item.variant_id);
    setEditModifiers([...item.modifiers]);
  };

  const saveEditItem = () => {
    if (editingIndex === null) return;
    const item = items[editingIndex];
    const newVariant = variants.find((v: any) => v.id === editVariantId);

    // Auto-scale preserved promo portion when qty changes
    let scaledLineDiscount = Number(item.line_discount || 0);
    if (item.qty > 0 && editQty !== item.qty) {
      const scale = editQty / item.qty;
      scaledLineDiscount = Math.round(scaledLineDiscount * scale);
    }

    setItems(items.map((it, i) => {
      if (i !== editingIndex) return it;
      return {
        ...it,
        qty: editQty,
        discount_amount: editDiscount,
        discount_type: editDiscountType,
        variant_id: editVariantId,
        size_name: newVariant?.size_name || it.size_name,
        unit_price: Number(newVariant?.price || it.unit_price),
        modifiers: [...editModifiers],
        line_discount: scaledLineDiscount,
      };
    }));
    setEditingIndex(null);
  };

  const addModifierToEdit = (mod: any) => {
    setEditModifiers([...editModifiers, { id: mod.id, name: mod.name, price: Number(mod.price || 0) }]);
  };

  const removeModifierFromEdit = (mod: any) => {
    const idx = editModifiers.findIndex((m: any) => m.id === mod.id);
    if (idx !== -1) {
      setEditModifiers(editModifiers.filter((_, i: number) => i !== idx));
    }
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
    setIsSaving(true);

    const subtotal = calculateSubtotal();
    let finalOrderDiscountVND = orderDiscount;
    if (orderDiscountType === "PERCENT") {
      finalOrderDiscountVND = subtotal * (orderDiscount / 100);
    }

    const editData = {
      items: items.map(item => {
        let itemDiscountVND = item.discount_amount;
        if (item.discount_type === "PERCENT") {
          const modsPrice = item.modifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0);
          const base = (item.unit_price + modsPrice) * item.qty;
          itemDiscountVND = base * (item.discount_amount / 100);
        }
        return {
          product_id: item.product_id,
          variant_id: item.variant_id,
          qty: item.qty,
          unit_price: item.unit_price,
          modifiers: item.modifiers,
          discount_amount: itemDiscountVND,         // backward compat
          line_discount: item.line_discount || 0,   // NEW: preserve promo portion
          line_manual_discount: itemDiscountVND,    // NEW: manual portion in correct field
          discount_type: "VND",
        };
      }),
      total_amount: calculateTotal(),
      subtotal_amount: subtotal,
      discount_amount: finalOrderDiscountVND,
      discount_type: "VND",
      payment_method: paymentMethod,
    };

    const res = await editOrder(order.id, editData);
    setIsSaving(false);

    if (res.success) {
      const updatedOrder: Order = {
        ...order,
        total_amount: calculateTotal(),
        subtotal_amount: subtotal,
        discount_amount: finalOrderDiscountVND,
        discount_type: "VND",
        method: paymentMethod,
        lines: items.map((item, idx) => {
          let itemDiscountVND = item.discount_amount;
          if (item.discount_type === "PERCENT") {
            const modsPrice = item.modifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0);
            const base = (item.unit_price + modsPrice) * item.qty;
            itemDiscountVND = base * (item.discount_amount / 100);
          }
          return {
            id: `OL-EDIT-${idx}`,
            product_id: item.product_id,
            variant_id: item.variant_id,
            product_name: item.product_name,
            size_name: item.size_name,
            qty: item.qty,
            unit_price: item.unit_price,
            line_discount: itemDiscountVND,
            discount_type: "VND",
            modifiers_json: JSON.stringify(item.modifiers),
            modifiers: item.modifiers,
          };
        }),
      };
      onSave(updatedOrder);
    } else {
      alert("Loi cap nhat don: " + res.error);
    }
  };

  // Get available variants for an item being edited
  const getEditVariants = () => {
    if (editingIndex === null) return [];
    const item = items[editingIndex];
    return variants.filter((v: any) => v.product_id === item.product_id);
  };

  // Build the edit-mode item preview with price totals
  const getEditItemTotals = () => {
    if (editingIndex === null) return { base: 0, final: 0 };
    const item = items[editingIndex];
    const variant = variants.find((v: any) => v.id === editVariantId);
    const unitPrice = Number(variant?.price || item.unit_price);
    const modsPrice = editModifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0);
    const base = (unitPrice + modsPrice) * editQty;

    let manualDisc = 0;
    if (editDiscount > 0) {
      manualDisc = editDiscountType === "PERCENT" ? (base * editDiscount) / 100 : editDiscount;
    }
    // Scaled promo portion (matches saveEditItem logic)
    const promoDisc = item.qty > 0 && editQty !== item.qty
      ? Math.round(Number(item.line_discount || 0) * (editQty / item.qty))
      : Number(item.line_discount || 0);

    return { base, final: Math.max(0, base - manualDisc - promoDisc) };
  };

  const totalAmount = calculateTotal();

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
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

          {items.map((item, idx) => {
            const lineTotal = calcItemTotal(item);
            const baseTotal = calcItemBaseTotal(item);

            if (editingIndex === idx) {
              const editVariants = getEditVariants();
              const editTotals = getEditItemTotals();

              return (
                <div key={idx} className="bg-indigo-50 p-3 rounded-xl border-2 border-indigo-200 space-y-3">
                  <div className="font-bold text-gray-800">{item.product_name}</div>

                  {/* Size selection */}
                  {editVariants.length > 1 && (
                    <div>
                      <div className="text-xs font-medium text-gray-500 mb-1.5">Size</div>
                      <div className="flex flex-wrap gap-2">
                        {editVariants.map((v: any) => (
                          <button
                            key={v.id}
                            onClick={() => setEditVariantId(v.id)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${editVariantId === v.id
                                ? "border-orange-500 bg-orange-50 text-orange-700"
                                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                              }`}
                          >
                            {v.size_name} - {Number(v.price).toLocaleString("vi-VN")}d
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Topping editing */}
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1.5">Topping</div>
                    <div className="space-y-2">
                      {Object.entries(groupedModifiers).map(([groupName, mods]) => (
                        <div key={groupName}>
                          <div className="text-[11px] text-gray-400 mb-1">{groupName}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {mods.map((mod: any) => {
                              const count = editModifiers.filter((m: any) => m.id === mod.id).length;
                              return (
                                <div key={mod.id} className={`flex items-center gap-1 rounded-lg border text-xs ${count > 0 ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white"
                                  }`}>
                                  {count > 0 && (
                                    <button onClick={() => removeModifierFromEdit(mod)} className="px-1.5 py-1 text-indigo-400 hover:text-red-500 font-bold">-</button>
                                  )}
                                  <span className="px-1 py-1">{mod.name} <span className="text-gray-400">+{Number(mod.price).toLocaleString("vi-VN")}d</span></span>
                                  {count > 0 && <span className="px-1 py-1 font-bold text-indigo-600">{count}x</span>}
                                  <button onClick={() => addModifierToEdit(mod)} className="px-1.5 py-1 text-gray-400 hover:text-indigo-600 font-bold">+</button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Qty & Discount */}
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">SL:</span>
                      <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
                        <button onClick={() => setEditQty(Math.max(1, editQty - 1))} className="w-7 h-7 flex items-center justify-center bg-white rounded border text-gray-600 font-bold">-</button>
                        <span className="font-bold w-6 text-center">{editQty}</span>
                        <button onClick={() => setEditQty(editQty + 1)} className="w-7 h-7 flex items-center justify-center bg-white rounded border text-gray-600 font-bold">+</button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm font-medium text-gray-700">Giảm:</span>
                      <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
                        <button onClick={() => setEditDiscountType("VND")} className={`px-2 py-1 text-xs font-bold ${editDiscountType === "VND" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"}`}>VND</button>
                        <button onClick={() => setEditDiscountType("PERCENT")} className={`px-2 py-1 text-xs font-bold ${editDiscountType === "PERCENT" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"}`}>%</button>
                      </div>
                      <input type="number" min="0" value={editDiscount || ""} onChange={(e) => setEditDiscount(Number(e.target.value))} className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-indigo-500" />
                    </div>
                  </div>

                  {/* Price totals */}
                  <div className="bg-white rounded-lg p-2.5 border border-indigo-100 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Giá gốc</span>
                      <span className="text-gray-700 font-medium">{editTotals.base.toLocaleString("vi-VN")}đ</span>
                    </div>
                    {(() => {
                      const item = items[editingIndex];
                      if (!item || Number(item.line_discount || 0) === 0) return null;
                      const scaledPromo = item.qty > 0 && editQty !== item.qty
                        ? Math.round(Number(item.line_discount || 0) * (editQty / item.qty))
                        : Number(item.line_discount || 0);
                      return (
                        <div className="flex justify-between text-sm text-emerald-600">
                          <span>⚡ KM (tự scale theo SL)</span>
                          <span>-{scaledPromo.toLocaleString("vi-VN")}đ</span>
                        </div>
                      );
                    })()}
                    {editDiscount > 0 && (
                      <div className="flex justify-between text-sm text-red-500">
                        <span>Chiết khấu</span>
                        <span>-{(editTotals.base - editTotals.final - (Number(items[editingIndex]?.line_discount || 0) > 0
                          ? (items[editingIndex].qty > 0 && editQty !== items[editingIndex].qty
                            ? Math.round(Number(items[editingIndex].line_discount || 0) * (editQty / items[editingIndex].qty))
                            : Number(items[editingIndex].line_discount || 0))
                          : 0)).toLocaleString("vi-VN")}đ</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold pt-1 border-t border-gray-100">
                      <span className="text-gray-800">Thành tiền</span>
                      <span className="text-orange-600">{editTotals.final.toLocaleString("vi-VN")}đ</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditingIndex(null)} className="flex-1 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Hủy</button>
                    <button onClick={saveEditItem} className="flex-1 py-1.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Lưu</button>
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
                    {(item.discount_amount > 0 || item.line_discount > 0 || item.line_manual_discount > 0) && (
                      <div className="text-[11px] text-gray-400 line-through">{baseTotal.toLocaleString("vi-VN")}d</div>
                    )}
                    <div className="font-bold text-gray-800">{lineTotal.toLocaleString("vi-VN")}d</div>
                  </div>
                </div>
                {item.modifiers.length > 0 && (
                  <div className="text-xs text-indigo-600 mb-1">+ {item.modifiers.map((m: any) => m.name).join(", ")}</div>
                )}
                {item.line_discount > 0 && (
                  <div className="text-xs text-emerald-600 font-medium mb-0.5">
                    KM: -{item.line_discount.toLocaleString("vi-VN")}đ
                  </div>
                )}
                {(item.discount_amount > 0 || item.line_manual_discount > 0) && (
                  <div className="text-xs text-red-500 font-medium mb-1">
                    Giảm: -{item.discount_type === "PERCENT" ? `${item.discount_amount}%` : `${Number(item.discount_amount || item.line_manual_discount).toLocaleString("vi-VN")}đ`}
                  </div>
                )}
                <div className="flex gap-2 mt-2">
                  <button onClick={() => startEditItem(idx)} className="text-xs font-medium text-indigo-600 px-2 py-1 bg-indigo-50 rounded hover:bg-indigo-100">Sửa</button>
                  <button onClick={() => removeItem(idx)} className="text-xs font-medium text-red-500 px-2 py-1 bg-red-50 rounded hover:bg-red-100">Xóa</button>
                </div>
              </div>
            );
          })}

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
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700 w-28">Giảm giá đơn:</span>
              <div className="flex items-center gap-2 flex-1">
                <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
                  <button onClick={() => setOrderDiscountType("VND")} className={`px-2 py-1 text-xs font-bold ${orderDiscountType === "VND" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"}`}>VND</button>
                  <button onClick={() => setOrderDiscountType("PERCENT")} className={`px-2 py-1 text-xs font-bold ${orderDiscountType === "PERCENT" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"}`}>%</button>
                </div>
                <input type="number" min="0" value={orderDiscount || ""} onChange={(e) => setOrderDiscount(Number(e.target.value))} className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-indigo-500" />
              </div>
            </div>
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

          <div className="px-4 py-3 flex gap-3 bg-white">
            <button onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50">Hủy</button>
            <button onClick={handleSave} disabled={isSaving || items.length === 0} className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50">
              {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}