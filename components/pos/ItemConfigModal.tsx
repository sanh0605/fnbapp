"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/format";

export type ItemConfigSubmission = {
  variant: any;
  modifiers: any[];
  qty: number;
  discountAmount: number;
  discountType: "VND" | "PERCENT";
};

interface ItemConfigModalProps {
  product: any;
  variants: any[];
  groupedModifiers: Record<string, any[]>;
  promoVariantsMap: Map<string, number>;
  promoDetailsMap: Map<string, any>;
  initialLine: any | null;
  isEditing: boolean;
  onSubmit: (config: ItemConfigSubmission) => void;
  onClose: () => void;
}

export function ItemConfigModal({
  product,
  variants,
  groupedModifiers,
  promoVariantsMap,
  promoDetailsMap,
  initialLine,
  isEditing,
  onSubmit,
  onClose,
}: ItemConfigModalProps) {
  const prodVariants = variants.filter((v: any) => v.product_id === product.id);

  const [selectedVariant, setSelectedVariant] = useState<any>(() =>
    initialLine
      ? prodVariants.find((v: any) => v.id === initialLine.variant_id) || prodVariants[0]
      : prodVariants[0]
  );
  const [selectedModifiers, setSelectedModifiers] = useState<any[]>(() =>
    initialLine ? [...initialLine.modifiers] : []
  );
  const [selectedQty, setSelectedQty] = useState<number>(() => (initialLine ? initialLine.qty : 1));
  const [itemDiscount, setItemDiscount] = useState<number>(() =>
    initialLine ? initialLine.discount_amount || 0 : 0
  );
  const [itemDiscountType, setItemDiscountType] = useState<"VND" | "PERCENT">(() =>
    initialLine ? initialLine.discount_type || "VND" : "VND"
  );

  const addModifier = (mod: any) => {
    setSelectedModifiers([...selectedModifiers, mod]);
  };

  const removeModifier = (mod: any) => {
    const index = selectedModifiers.findIndex(m => m.id === mod.id);
    if (index !== -1) {
      const newModifiers = [...selectedModifiers];
      newModifiers.splice(index, 1);
      setSelectedModifiers(newModifiers);
    }
  };

  const addToCart = () => {
    if (!selectedVariant) return;

    onSubmit({
      variant: selectedVariant,
      modifiers: selectedModifiers,
      qty: selectedQty,
      discountAmount: itemDiscount,
      discountType: itemDiscountType,
    });
  };

  const currentItemBasePrice = selectedVariant ? Number(selectedVariant.price) + selectedModifiers.reduce((sum, m) => sum + Number(m.price), 0) : 0;
  const currentItemBaseTotal = currentItemBasePrice * selectedQty;
  let currentItemManualDiscountAmount = 0;
  if (itemDiscount > 0) {
    if (itemDiscountType === "PERCENT") {
      currentItemManualDiscountAmount = (currentItemBaseTotal * itemDiscount) / 100;
    } else {
      currentItemManualDiscountAmount = itemDiscount;
    }
  }

  // Calculate promo discount for the current selection in modal
  let currentItemPromoDiscountAmount = 0;
  if (selectedVariant && promoDetailsMap.has(selectedVariant.id)) {
    const promo = promoDetailsMap.get(selectedVariant.id);
    if (promo.type === "PERCENT") {
      currentItemPromoDiscountAmount = currentItemBaseTotal * (promo.val / 100);
    } else if (promo.type === "FLAT_PRICE") {
      const unitDiscount = Math.max(0, Number(selectedVariant.price) - promo.val);
      currentItemPromoDiscountAmount = unitDiscount * selectedQty;
    } else {
      currentItemPromoDiscountAmount = promo.val * selectedQty;
    }
  }

  const currentItemFinalTotal = Math.max(0, currentItemBaseTotal - currentItemManualDiscountAmount - currentItemPromoDiscountAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-surface-card/95 backdrop-blur-2xl border border-border/40 w-full sm:w-[500px] max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slide-up sm:animate-fade-in">
        <div className="p-4 border-b border-border/50 flex justify-between items-center bg-page/50">
          <h3 className="text-xl font-bold text-text-primary">{product.name}</h3>
          <button onClick={onClose} className="p-1.5 bg-border rounded-full text-text-secondary hover:bg-border" aria-label="Đóng">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6 bg-surface-card">
          {/* SIZE SELECTION */}
          <div>
            <h4 className="font-bold text-sm text-text-primary mb-3 uppercase">Chọn Size</h4>
            <div className="grid grid-cols-2 gap-3">
              {variants.filter((v: any) => v.product_id === product.id).map((v: any) => {
                const hasPromo = promoVariantsMap.has(v.id);
                const promoPrice = promoVariantsMap.get(v.id);

                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-colors ${selectedVariant?.id === v.id ? "border-warning bg-warning/10" : "border-border bg-surface-card hover:border-warning/30"}`}
                  >
                    <span className={`font-bold text-sm ${selectedVariant?.id === v.id ? "text-warning" : "text-text-primary"}`}>{v.size_name}</span>
                    {hasPromo ? (
                      <div className="flex flex-col items-center">
                        <span className="text-xs text-text-muted line-through">{formatNumber(v.price)}</span>
                        <span className="text-sm font-black text-warning">{formatNumber(promoPrice)}</span>
                      </div>
                    ) : (
                      <span className="text-sm font-black text-text-primary">{formatNumber(v.price)}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* MODIFIERS (TOPPINGS, SUGAR, ICE) */}
          {Object.keys(groupedModifiers).map(groupName => (
            <div key={groupName}>
              <h4 className="font-bold text-sm text-text-primary mb-3 uppercase">{groupName}</h4>
              <div className="flex flex-col gap-2">
                {groupedModifiers[groupName].map((mod: any) => {
                  const count = selectedModifiers.filter(m => m.id === mod.id).length;
                  return (
                    <div key={mod.id} className={`flex justify-between items-center px-4 py-3 rounded-xl border transition-colors ${count > 0 ? "border-primary bg-primary-soft shadow-sm" : "border-border bg-surface-card hover:bg-page"}`}>
                      <div className="flex flex-col">
                        <span className={`text-sm ${count > 0 ? "text-primary font-bold" : "text-text-primary font-medium"}`}>{mod.name}</span>
                        {Number(mod.price) > 0 && (
                          <span className="text-xs text-text-secondary mt-0.5">+{formatNumber(mod.price)}</span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => removeModifier(mod)}
                          disabled={count === 0}
                          className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-lg transition-colors ${count > 0 ? "bg-surface-card text-primary border border-primary/20 hover:bg-primary-soft shadow-sm" : "bg-surface-secondary text-text-muted cursor-not-allowed"}`}
                        >
                          -
                        </button>
                        <span className={`font-bold w-4 text-center ${count > 0 ? "text-primary" : "text-text-secondary"}`}>
                          {count}
                        </span>
                        <button
                          onClick={() => addModifier(mod)}
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-card text-primary border border-primary/20 hover:bg-primary-soft font-bold text-lg transition-colors shadow-sm"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border/50 bg-surface-card/95 backdrop-blur-md shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col gap-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">

          {/* CHIẾT KHẤU MÓN (Dời xuống footer) */}
          <div className="flex items-center justify-between gap-4">
            <span className="font-bold text-sm text-text-primary whitespace-nowrap">Chiết khấu:</span>
            <div className="flex items-center gap-2 flex-1">
              <div className="flex rounded-lg overflow-hidden border border-border shrink-0 h-10">
                <button
                  onClick={() => setItemDiscountType("VND")}
                  className={`px-3 py-1.5 text-sm font-bold transition-colors ${itemDiscountType === "VND" ? "bg-warning/10 text-warning" : "bg-page text-text-secondary hover:bg-surface-secondary"}`}
                >
                  VNĐ
                </button>
                <button
                  onClick={() => setItemDiscountType("PERCENT")}
                  className={`px-3 py-1.5 text-sm font-bold transition-colors ${itemDiscountType === "PERCENT" ? "bg-warning/10 text-warning" : "bg-page text-text-secondary hover:bg-surface-secondary"}`}
                >
                  %
                </button>
              </div>
              <input
                aria-label="Giảm giá sản phẩm"
                type="number"
                min="0"
                placeholder="Nhập số..."
                value={itemDiscount || ""}
                onChange={(e) => setItemDiscount(Number(e.target.value))}
                className="flex-1 w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring outline-none h-10 text-right"
              />
            </div>
          </div>

          {/* TỔNG TIỀN & NÚT CẬP NHẬT */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-surface-secondary rounded-xl p-1.5 shrink-0 h-14">
              <button
                onClick={() => setSelectedQty(Math.max(1, selectedQty - 1))}
                className="w-10 h-10 flex items-center justify-center bg-surface-card rounded-lg shadow-sm text-text-secondary font-bold text-xl hover:text-warning transition-colors"
              >
                -
              </button>
              <span className="text-lg font-black w-6 text-center text-text-primary">{selectedQty}</span>
              <button
                onClick={() => setSelectedQty(selectedQty + 1)}
                className="w-10 h-10 flex items-center justify-center bg-surface-card rounded-lg shadow-sm text-text-secondary font-bold text-xl hover:text-warning transition-colors"
              >
                +
              </button>
            </div>

            <button
              onClick={addToCart}
              className="flex-1 bg-warning text-white py-2 px-3 rounded-xl hover:bg-warning/90 active:scale-[0.98] transition-colors transition-transform flex flex-col items-center justify-center h-14"
            >
              <div className="font-bold text-sm lg:text-base flex flex-col items-center">
                <span>{isEditing ? "CẬP NHẬT" : "THÊM"} - {formatNumber(currentItemFinalTotal)}</span>
              </div>
              {(currentItemManualDiscountAmount > 0 || currentItemPromoDiscountAmount > 0) && (
                <div className="text-[10px] lg:text-xs text-white/70 line-through font-medium mt-0.5">
                  Gốc: {formatNumber(currentItemBaseTotal)}
                </div>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
