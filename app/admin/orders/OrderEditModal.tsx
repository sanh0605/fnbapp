"use client";

import { useState, useMemo } from "react";
import { formatNumber } from "@/lib/format";
import { editOrderV2 } from "./actions";
import type { CartInput } from "@/lib/order-cart";
import type { OrderListItem } from "./actions";
import { LineItemEditor } from "./components/LineItemEditor";
import { DiscountEditor } from "./components/DiscountEditor";
import type { EditItem } from "./components/LineItemEditor";
import { Button } from "@/components/ui/Button";
import { X, Search } from "lucide-react";

type OrderLine = OrderListItem["lines"][0];
type Order = OrderListItem;

function expandModifierSnapshots(modifiers: any[]): any[] {
  return modifiers.flatMap((modifier: any) => {
    const qty = Math.max(1, Number(modifier.qty || 1));
    return Array.from({ length: qty }, () => ({
      id: modifier.id,
      name: modifier.name,
      price: Number(modifier.price || 0),
    }));
  });
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
      modifiers: expandModifierSnapshots(l.modifiers || []),
      discount_amount: Number(l.manual_item_discount || 0),
      line_discount: Number(l.promo_discount || 0),
      line_promo_discount: Number(l.promo_discount || 0),
      line_order_discount_allocation: Number(l.order_discount_allocation || 0),
      line_manual_discount: Number(l.manual_item_discount || 0),
      discount_type: "VND",
    }))
  );

  const [orderDiscount, setOrderDiscount] = useState(Number(order.manual_order_discount || 0));
  const [orderDiscountType, setOrderDiscountType] = useState("VND");
  const [paymentMethod, setPaymentMethod] = useState(order.method || "Tien mat");
  const [isSaving, setIsSaving] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
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
      line_promo_discount: 0,
      line_order_discount_allocation: 0,
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
    setInlineError(null);
    if (items.length === 0) return;
    if (!editReason.trim()) {
      setInlineError("Lý do chỉnh sửa là bắt buộc");
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
          unit_price_snapshot: item.unit_price,
          promo_discount_snapshot: item.line_promo_discount,
          qty: item.qty,
          modifiers: item.modifiers.map(m => ({
            modifier_id: m.id,
            modifier_qty: 1,
            modifier_name_snapshot: m.name,
            modifier_price_snapshot: Number(m.price || 0),
          })),
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
      setInlineError("Lỗi cập nhật đơn: " + res.error);
    }
  };



  const totalAmount = calculateTotal();

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card w-full max-w-lg h-[100dvh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-card shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="p-4 border-b border-border bg-page flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Sửa đơn hàng</h3>
            <p className="text-sm text-text-secondary">{order.display_order_no || order.order_no}</p>
          </div>
          <button onClick={onClose} disabled={isSaving} className="p-1.5 bg-surface-secondary rounded-full text-text-muted hover:bg-border disabled:opacity-50">
            <X className="w-5 h-5" />
          </button>
        </div>

        {inlineError && (
          <div role="alert" aria-live="polite" className="mx-4 mt-4 p-3 bg-red-50 text-danger text-sm rounded-lg border border-red-200 flex justify-between">
            <span>{inlineError}</span>
            <button onClick={() => setInlineError(null)} className="ml-2 text-danger hover:opacity-80" aria-label="Đóng"><X className="w-4 h-4"/></button>
          </div>
        )}

        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 && !isAddingProduct && (
            <div className="text-center text-text-muted py-8">Không có món nào trong đơn</div>
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
            <div className="bg-primary-soft p-3 rounded-xl border border-primary/20 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-primary">Thêm sản phẩm</span>
                <button onClick={() => { setIsAddingProduct(false); setSelectedNewProduct(null); setSelectedNewVariant(null); setSelectedNewModifiers([]); setNewQty(1); }} className="text-text-muted hover:text-text-secondary">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!selectedNewProduct ? (
                <>
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-text-muted" />
                    <input type="text" placeholder="Tìm sản phẩm..." value={addSearch} onChange={(e) => setAddSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-surface-card text-text-primary outline-none focus:ring-1 focus:ring-focus-ring" />
                  </div>

                  {/* Category filter */}
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setAddCategory("ALL")} className={`px-2.5 py-1 rounded-full text-xs font-medium ${addCategory === "ALL" ? "bg-primary text-white" : "bg-surface-card text-text-secondary border border-border"}`}>Tất cả</button>
                    {categories.map((c: any) => (
                      <button key={c.id} onClick={() => setAddCategory(c.id)} className={`px-2.5 py-1 rounded-full text-xs font-medium ${addCategory === c.id ? "bg-primary text-white" : "bg-surface-card text-text-secondary border border-border"}`}>{c.name}</button>
                    ))}
                  </div>

                  {/* Product grid */}
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {filteredAddProducts.map((p: any) => (
                      <button key={p.id} onClick={() => { setSelectedNewProduct(p); setSelectedNewVariant(null); }} className="p-2 rounded-lg border border-border bg-surface-card hover:border-primary text-center transition-colors">
                        <div className="text-sm font-medium text-text-primary truncate">{p.name}</div>
                      </button>
                    ))}
                    {filteredAddProducts.length === 0 && (
                      <div className="col-span-3 text-center text-text-muted text-sm py-4">Không tìm thấy sản phẩm</div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Selected product detail */}
                  <div className="font-bold text-text-primary">{selectedNewProduct.name}</div>

                  {/* Variant selection */}
                  <div>
                    <div className="text-xs font-medium text-text-muted mb-1.5">Size</div>
                    <div className="flex flex-wrap gap-2">
                      {variants.filter((v: any) => v.product_id === selectedNewProduct.id).map((v: any) => (
                        <button key={v.id} onClick={() => setSelectedNewVariant(v)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedNewVariant?.id === v.id ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface-card text-text-secondary hover:border-border-hover"
                          }`}>
                          {v.size_name} - {formatNumber(v.price)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Modifier selection */}
                  {selectedNewVariant && (
                    <div>
                      <div className="text-xs font-medium text-text-muted mb-1.5">Topping</div>
                      <div className="space-y-2">
                        {Object.entries(groupedModifiers).map(([groupName, mods]) => (
                          <div key={groupName}>
                            <div className="text-[11px] text-text-muted mb-1">{groupName}</div>
                            <div className="flex flex-wrap gap-1.5">
                              {mods.map((mod: any) => {
                                const count = selectedNewModifiers.filter((m: any) => m.id === mod.id).length;
                                return (
                                  <div key={mod.id} className={`flex items-center gap-1 rounded-lg border text-xs ${count > 0 ? "border-primary bg-primary-soft" : "border-border bg-surface-card"
                                    }`}>
                                    {count > 0 && (
                                      <button onClick={() => removeNewModifier(mod)} className="px-1.5 py-1 text-primary hover:text-danger font-bold">-</button>
                                    )}
                                    <span className="px-1 py-1 text-text-primary">{mod.name} <span className="text-text-muted">+{formatNumber(mod.price)}</span></span>
                                    {count > 0 && <span className="px-1 py-1 font-bold text-primary">{count}x</span>}
                                    <button onClick={() => addNewModifier(mod)} className="px-1.5 py-1 text-text-muted hover:text-primary font-bold">+</button>
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
                        <span className="text-sm font-medium text-text-secondary">SL:</span>
                        <div className="flex items-center gap-1 bg-surface-card rounded-lg p-1 border border-border">
                          <button onClick={() => setNewQty(Math.max(1, newQty - 1))} className="w-7 h-7 flex items-center justify-center bg-surface-card rounded border border-border text-text-secondary font-bold hover:bg-page">-</button>
                          <span className="font-bold w-6 text-center text-text-primary">{newQty}</span>
                          <button onClick={() => setNewQty(newQty + 1)} className="w-7 h-7 flex items-center justify-center bg-surface-card rounded border border-border text-text-secondary font-bold hover:bg-page">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-primary">{formatNumber((Number(selectedNewVariant.price) + selectedNewModifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0)) * newQty)}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => { setSelectedNewProduct(null); setSelectedNewVariant(null); setSelectedNewModifiers([]); }} className="flex-1">Quay lại</Button>
                    <Button variant="primary" onClick={confirmAddProduct} disabled={!selectedNewVariant} className="flex-1">Thêm vào đơn</Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Button variant="secondary" className="w-full border-dashed" onClick={() => setIsAddingProduct(true)}>
              + Thêm sản phẩm
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border shrink-0">
          <div className="px-4 py-3 bg-page space-y-3">
            <DiscountEditor
              orderDiscount={orderDiscount}
              orderDiscountType={orderDiscountType}
              setOrderDiscount={setOrderDiscount}
              setOrderDiscountType={setOrderDiscountType}
            />
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-text-secondary w-28">Thanh toán:</span>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="flex-1 border border-border rounded-lg px-3 py-1.5 text-sm bg-surface-card text-text-primary outline-none focus:ring-1 focus:ring-focus-ring">
                <option value="Tien mat">Tiền mặt</option>
                <option value="Chuyen khoan">Chuyển khoản</option>
              </select>
            </div>
          </div>

          <div className="px-4 py-2 flex justify-between items-center bg-surface-card border-t border-border">
            <span className="font-bold text-text-primary">Tổng cộng</span>
            <span className="text-xl font-black text-primary">{formatNumber(totalAmount)}</span>
          </div>

          <div className="px-4 py-3 bg-page border-t border-border">
            <label className="block text-xs font-bold text-text-secondary mb-1.5">Lý do chỉnh sửa (bắt buộc)</label>
            <textarea
              placeholder="VD: Khách đổi từ 1 ly thành 2 ly"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-surface-card text-text-primary outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </div>

          <div className="px-4 py-3 flex gap-3 bg-surface-card">
            <Button variant="secondary" onClick={onClose} disabled={isSaving} className="flex-1">Hủy</Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving || items.length === 0 || !editReason.trim()} className="flex-1">
              {isSaving ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
