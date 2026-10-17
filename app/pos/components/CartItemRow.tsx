"use client";

import { useState, useRef } from "react";
import { Trash2, Minus, Plus } from "lucide-react";
import { DiscountBadge, DISCOUNT_KIND } from "./DiscountBadge";
import { formatNumber } from "@/lib/shared/format";
import { calculateItemTotal, calculateItemGross } from "./cart-pricing";

interface CartItemRowProps {
  item: any;
  idx: number;
  products: any[];
  itemPromoDiscount: number;
  openProductModal: (product: any, idx: number) => void;
  removeFromCart: (idx: number) => void;
  changeQty: (idx: number, delta: number) => void;
}

export function CartItemRow({
  item,
  idx,
  products,
  itemPromoDiscount,
  openProductModal,
  removeFromCart,
  changeQty,
}: CartItemRowProps) {
  const [isSwiped, setIsSwiped] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX < 0) {
        setIsSwiped(true);
      } else {
        setIsSwiped(false);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const baseTotal = calculateItemGross(item);
  const finalTotal = calculateItemTotal(item);
  const manualItemDiscount = baseTotal - finalTotal;

  const currentProduct = products.find((p: any) => p.id === item.product_id);
  const modifiers = item.modifiers || [];
  const modifierCounts = new Map<string, { name: string; count: number }>();
  for (const m of modifiers) {
    const key = m.id || m.name;
    const existing = modifierCounts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      modifierCounts.set(key, { name: m.name, count: 1 });
    }
  }
  const modifierParts = Array.from(modifierCounts.values()).map(
    ({ name, count }) => (count > 1 ? `${name} ×${count}` : name)
  );
  const subLineText = [item.size_name, ...modifierParts].filter(Boolean).join(" · ");

  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-surface-card transition-all duration-200 animate-cart-item-in">
      {/* Background Red Delete Button */}
      <div className="absolute top-0 right-0 bottom-0 w-20 bg-danger flex items-center justify-center z-0">
        <button
          type="button"
          onClick={() => {
            removeFromCart(idx);
            setIsSwiped(false);
          }}
          className="w-full h-full min-h-[44px] text-white font-bold text-xs flex flex-col items-center justify-center gap-1 active:bg-danger"
        >
          <Trash2 className="w-5 h-5" />
          <span>Xoá</span>
        </button>
      </div>

      {/* Main Sliding Content */}
      <div
        className="bg-surface-card p-3 transition-transform duration-300 relative z-10 flex flex-col gap-2"
        style={{ transform: isSwiped ? "translateX(-80px)" : "translateX(0)" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top section: clickable dish name + grey second row, and line total on the right */}
        <div
          className="flex items-start justify-between gap-3 min-h-[44px] cursor-pointer"
          onClick={() => currentProduct && openProductModal(currentProduct, idx)}
        >
          <div className="flex-1 min-w-0">
            <h4 className="text-[17px] font-semibold text-text-primary leading-snug hover:text-primary transition-colors break-words">
              {item.product_name}
            </h4>

            {subLineText && (
              <div className="mt-0.5 text-[15px] text-text-secondary break-words">
                {subLineText}
              </div>
            )}

            {(itemPromoDiscount > 0 || manualItemDiscount > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {itemPromoDiscount > 0 && (
                  <DiscountBadge kind={DISCOUNT_KIND.PROMO} label="Hệ thống" amount={itemPromoDiscount} />
                )}
                {manualItemDiscount > 0 && (
                  <DiscountBadge kind={DISCOUNT_KIND.MANUAL_ITEM} label="Thu ngân" amount={manualItemDiscount} />
                )}
              </div>
            )}
          </div>

          <div className="text-right shrink-0">
            {(itemPromoDiscount > 0 || manualItemDiscount > 0) && (
              <div className="text-xs text-text-secondary line-through mb-0.5 tabular-nums">
                {formatNumber(baseTotal)}
              </div>
            )}
            <div className="font-bold text-text-primary text-[17px] leading-snug tabular-nums">
              {formatNumber(Math.max(0, finalTotal - itemPromoDiscount))}
            </div>
          </div>
        </div>

        {/* Bottom section: remove button & 44px stepper */}
        <div className="flex items-center justify-between border-t border-border pt-2">
          <button
            type="button"
            onClick={() => removeFromCart(idx)}
            className="hidden md:flex min-h-[44px] min-w-[44px] rounded-button text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors items-center justify-center"
            aria-label="Xoá"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsSwiped(!isSwiped)}
            className="md:hidden text-xs text-danger font-semibold px-4 py-2 bg-danger/10 active:bg-danger/20 rounded-button min-h-[44px] transition-colors"
          >
            Xoá
          </button>

          <div className="flex items-center border border-border rounded-button overflow-hidden bg-surface-card">
            <button
              type="button"
              onClick={() => changeQty(idx, -1)}
              aria-label="Giảm số lượng"
              className="w-11 h-11 min-h-[44px] min-w-[44px] bg-primary-soft text-primary hover:bg-primary/20 flex items-center justify-center transition-colors select-none"
            >
              <Minus className="w-4 h-4 text-primary" />
            </button>
            <span className="w-11 h-11 min-h-[44px] min-w-[44px] flex items-center justify-center text-sm font-semibold tabular-nums text-center text-text-primary select-none">
              {item.qty}
            </span>
            <button
              type="button"
              onClick={() => changeQty(idx, 1)}
              aria-label="Tăng số lượng"
              className="w-11 h-11 min-h-[44px] min-w-[44px] bg-primary-soft text-primary hover:bg-primary/20 flex items-center justify-center transition-colors select-none"
            >
              <Plus className="w-4 h-4 text-primary" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


