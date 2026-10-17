"use client";

import { useState, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { formatNumber } from "@/lib/shared/format";
import { OptionGroupPicker } from "./OptionGroupPicker";
import { orderPicks, type ProductOptionGroup } from "@/lib/sales/option-groups";
import { priceCart, toPricePromotion, eligiblePromotionSets } from "@/lib/sales/price-cart";
import { clampDiscount, calculateItemGross } from "./cart-pricing";

export type ItemConfigSubmission = {
  variant: any;
  modifiers: any[];
  qty: number;
  discountAmount: number;
  discountType: "VND" | "PERCENT";
};

interface ItemPickerProps {
  product: any;
  variants: any[];
  groups?: ProductOptionGroup[];
  promoVariantsMap: Map<string, number>;
  promotions: any[];
  brandId: string;
  appliedPromoCode?: string | null;
  initialLine: any | null;
  isEditing: boolean;
  onSubmit: (config: ItemConfigSubmission) => void;
  onClose: () => void;
}

export function ItemPicker({
  product,
  variants,
  groups = [],
  promoVariantsMap,
  promotions,
  brandId,
  appliedPromoCode,
  initialLine,
  isEditing,
  onSubmit,
  onClose,
}: ItemPickerProps) {
  const prodVariants = variants
    .filter((v: any) => v.product_id === product.id)
    .slice()
    .sort((a: any, b: any) => Number(a.price) - Number(b.price));

  const [selectedVariant, setSelectedVariant] = useState<any>(() =>
    initialLine
      ? prodVariants.find((v: any) => v.id === initialLine.variant_id) || prodVariants[0]
      : prodVariants[0]
  );
  const [selectedModifiers, setSelectedModifiers] = useState<any[]>(() =>
    initialLine ? [...initialLine.modifiers] : []
  );
  const maxQty = Math.max(99, initialLine?.qty ?? 1);
  const [selectedQty, setSelectedQty] = useState<number>(() =>
    initialLine ? Math.min(maxQty, Math.max(1, Number(initialLine.qty) || 1)) : 1
  );
  const [itemDiscount, setItemDiscount] = useState<number>(() =>
    initialLine ? initialLine.discount_amount || 0 : 0
  );
  const [itemDiscountType, setItemDiscountType] = useState<"VND" | "PERCENT">(() =>
    initialLine ? initialLine.discount_type || "VND" : "VND"
  );
  const [isDiscountOpen, setIsDiscountOpen] = useState<boolean>(() =>
    Boolean(initialLine && Number(initialLine.discount_amount) > 0)
  );

  const lineSubtotal = calculateItemGross({
    unit_price: Number(selectedVariant?.price || 0),
    qty: selectedQty,
    modifiers: selectedModifiers,
  });

  useEffect(() => {
    setItemDiscount((prev) => clampDiscount(prev, itemDiscountType, lineSubtotal) ?? 0);
  }, [lineSubtotal, itemDiscountType]);

  const addToCart = () => {
    if (!selectedVariant) return;

    onSubmit({
      variant: selectedVariant,
      modifiers: orderPicks(selectedModifiers, groups),
      qty: selectedQty,
      discountAmount: itemDiscount,
      discountType: itemDiscountType,
    });
  };

  const singleItem = selectedVariant
    ? [
        {
          variant_id: selectedVariant.id,
          qty: selectedQty,
          modifiers: selectedModifiers.map((m: any) => ({
            modifier_id: m.id,
            modifier_qty: 1,
          })),
          manual_item_discount: {
            value: Number(itemDiscount || 0),
            type: itemDiscountType,
          },
        },
      ]
    : [];

  const singleCatalog = selectedVariant
    ? {
        variants: [{ id: selectedVariant.id, price: Number(selectedVariant.price) }],
        modifiers: selectedModifiers.map((m: any) => ({ id: m.id, price: Number(m.price) })),
      }
    : { variants: [], modifiers: [] };

  const sets =
    promotions.length > 0
      ? eligiblePromotionSets(
          promotions,
          singleItem,
          singleCatalog,
          new Date().toISOString(),
          brandId,
          appliedPromoCode ?? null
        )
      : [];
  const bestSet = sets[0];
  const promoToApply = bestSet
    ? promotions.filter((p: any) => bestSet.promotionIds.includes(p.id)).map(toPricePromotion)
    : [];

  const priced = selectedVariant
    ? priceCart(singleItem, singleCatalog, promoToApply, null)
    : null;

  const currentItemBaseTotal = priced ? priced.lines[0]?.gross ?? 0 : 0;
  const currentItemManualDiscountAmount = priced ? priced.lines[0]?.manualItem ?? 0 : 0;
  const currentItemPromoDiscountAmount = priced
    ? (priced.lines[0]?.promo ?? 0) + (priced.lines[0]?.orderPromo ?? 0)
    : 0;
  const currentItemFinalTotal = priced ? priced.total : 0;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-text-primary/45 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-x-0 bottom-0 top-[54px] z-50 rounded-t-[18px] bg-page flex flex-col min-h-0 overflow-hidden shadow-panel md:static md:inset-auto md:z-auto md:flex-1 md:min-h-0 md:mx-4 md:mb-3 md:rounded-card md:bg-surface-card md:border md:border-border">
        <div className="w-11 h-1.5 rounded-full bg-border mx-auto mt-2 shrink-0 md:hidden" />

        <div className="flex items-center justify-between px-4 py-1.5 md:px-3.5 md:pt-3 md:pb-2 shrink-0">
          <h3 className="text-[22px] md:text-[21px] font-extrabold text-text-primary">
            {product.name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="w-12 h-12 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-secondary hover:text-text-primary md:hidden"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 px-3 pb-3 md:px-3.5 md:pb-2.5">
          <div className="flex flex-col md:grid md:grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3 md:gap-2.5">
            {/* Group 1: Cỡ ly */}
            <div className="bg-surface-card border border-border rounded-card overflow-hidden flex flex-col">
              <div className="flex items-center gap-2.5 min-h-[46px] md:min-h-[42px] px-3.5 md:px-2.5 bg-surface-secondary border-b border-border shrink-0">
                <b className="w-[26px] h-[26px] md:w-6 md:h-6 rounded-full bg-primary text-on-primary text-[14px] md:text-[13px] font-extrabold flex items-center justify-center shrink-0">
                  1
                </b>
                <span className="text-[17px] md:text-[16px] font-extrabold text-text-primary">
                  Cỡ ly
                </span>
                {selectedVariant && (
                  <span className="ml-auto text-[14px] font-bold text-primary md:hidden">
                    ✓ {selectedVariant.size_name}
                  </span>
                )}
              </div>

              <div className="flex flex-col" role="radiogroup" aria-label="Cỡ ly">
                {prodVariants.map((v: any) => {
                  const isSelected = selectedVariant?.id === v.id;
                  const hasPromo = promoVariantsMap.has(v.id);
                  const promoPrice = promoVariantsMap.get(v.id);

                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      key={v.id}
                      onClick={() => setSelectedVariant(v)}
                      className={`w-full flex items-center min-h-[54px] md:min-h-[46px] px-3.5 md:px-2.5 border-t border-border first:border-t-0 text-[18px] md:text-[16px] text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary-soft text-primary font-bold"
                          : "border-border bg-surface-card text-text-primary font-medium hover:bg-page"
                      }`}
                    >
                      <span
                        className={`break-words ${
                          isSelected ? "text-primary font-bold" : "text-text-primary font-medium"
                        }`}
                      >
                        {v.size_name}
                      </span>
                      {hasPromo ? (
                        <span className="ml-auto mr-3 md:mr-2 flex items-center gap-1.5 text-[16px] md:text-[15px] shrink-0 whitespace-nowrap">
                          <span className="text-xs text-text-muted line-through font-normal">
                            {formatNumber(v.price)}
                          </span>
                          <span className="font-bold text-primary">{formatNumber(promoPrice)}</span>
                        </span>
                      ) : (
                        <span className="ml-auto mr-3 md:mr-2 text-[16px] md:text-[15px] text-text-secondary font-normal shrink-0 whitespace-nowrap">
                          {formatNumber(v.price)}
                        </span>
                      )}
                      <span
                        aria-hidden="true"
                        className={`w-[26px] h-[26px] md:w-[22px] md:h-[22px] rounded-full shrink-0 ${
                          isSelected
                            ? "border-[8px] md:border-[7px] border-primary"
                            : "border-2 border-border"
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Option Groups (2, 3, ...) */}
            <OptionGroupPicker
              groups={groups}
              picks={selectedModifiers}
              onChange={setSelectedModifiers}
              startNumber={2}
            />
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-surface-card px-4 pt-2.5 pb-5 md:px-3.5 md:py-2.5 flex flex-col gap-2.5">
          <div>
            <button
              type="button"
              onClick={() => setIsDiscountOpen((prev) => !prev)}
              aria-expanded={isDiscountOpen}
              className="min-h-[44px] px-3 py-1.5 rounded-button border border-dashed border-border text-text-secondary hover:text-primary hover:border-primary text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Giảm giá món</span>
              <ChevronDown
                className={`w-4 h-4 shrink-0 transition-transform ${
                  isDiscountOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            <div className={isDiscountOpen ? "flex items-center gap-2 mt-2" : "hidden"}>
              <div className="flex rounded-button overflow-hidden border border-border shrink-0 min-h-[44px] h-11">
                <button
                  type="button"
                  onClick={() => setItemDiscountType("VND")}
                  className={`px-3 min-h-[44px] text-sm font-bold transition-colors ${
                    itemDiscountType === "VND"
                      ? "bg-primary-soft text-primary"
                      : "bg-page text-text-secondary hover:bg-surface-secondary"
                  }`}
                >
                  VNĐ
                </button>
                <button
                  type="button"
                  onClick={() => setItemDiscountType("PERCENT")}
                  className={`px-3 min-h-[44px] text-sm font-bold transition-colors ${
                    itemDiscountType === "PERCENT"
                      ? "bg-primary-soft text-primary"
                      : "bg-page text-text-secondary hover:bg-surface-secondary"
                  }`}
                >
                  %
                </button>
              </div>
              <input
                aria-label="Giảm giá sản phẩm"
                type="text"
                inputMode="numeric"
                placeholder="Ví dụ: 2"
                value={itemDiscount || ""}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "");
                  const val = digits === "" ? 0 : Number(digits);
                  const clamped = clampDiscount(val, itemDiscountType, lineSubtotal) ?? 0;
                  setItemDiscount(clamped);
                }}
                className="flex-1 w-full px-3 py-2 border border-border rounded-button focus:ring-2 focus:ring-focus-ring outline-none min-h-[44px] h-11 text-right text-base text-text-primary bg-surface-card"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center border border-border rounded-card md:rounded-button h-[60px] md:h-[52px] md:mr-auto shrink-0 bg-surface-card">
              <button
                type="button"
                aria-label="Bớt"
                disabled={selectedQty <= 1}
                onClick={() => setSelectedQty((q) => Math.max(1, q - 1))}
                className="w-[52px] h-[60px] md:h-[52px] min-h-[44px] flex items-center justify-center text-[26px] md:text-[24px] font-extrabold text-primary disabled:text-text-muted disabled:opacity-40 transition-colors"
              >
                −
              </button>
              <span className="w-[30px] md:w-8 text-center font-extrabold text-[22px] md:text-[20px] text-text-primary">
                {selectedQty}
              </span>
              <button
                type="button"
                aria-label="Thêm số lượng"
                disabled={selectedQty >= maxQty}
                onClick={() => setSelectedQty((q) => Math.min(maxQty, q + 1))}
                className="w-[52px] h-[60px] md:h-[52px] min-h-[44px] flex items-center justify-center text-[26px] md:text-[24px] font-extrabold text-primary disabled:text-text-muted disabled:opacity-40 transition-colors"
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="hidden md:inline-flex items-center justify-center h-[52px] min-h-[44px] px-5 rounded-button border border-border text-[17px] font-extrabold text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              Bỏ
            </button>

            <button
              type="button"
              onClick={addToCart}
              className="flex-1 md:flex-none bg-primary text-on-primary h-[60px] md:h-[52px] min-h-[44px] px-5 rounded-card md:rounded-button hover:bg-primary-hover active:scale-[0.98] transition-all flex flex-col items-center justify-center"
            >
              <div className="font-extrabold text-[18px] md:text-[17px] leading-tight">
                <span>
                  {isEditing ? "Cập nhật" : "Thêm vào đơn"} · {formatNumber(currentItemFinalTotal)}
                </span>
              </div>
              {(currentItemManualDiscountAmount > 0 || currentItemPromoDiscountAmount > 0) && (
                <div className="text-xs text-on-primary/80 line-through font-medium mt-0.5">
                  Gốc: {formatNumber(currentItemBaseTotal)}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
