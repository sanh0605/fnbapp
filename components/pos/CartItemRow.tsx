"use client";

import { useState, useRef } from "react";
import { DiscountBadge, DISCOUNT_KIND } from "./DiscountBadge";
import { formatNumber } from "@/lib/format";

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
  const finalTotal = Math.max(0, baseTotal - discount);
  const manualItemDiscount = baseTotal - finalTotal;

  const currentProduct = products.find((p: any) => p.id === item.product_id);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] bg-surface-card transition-all duration-200 animate-cart-item-in">
      {/* Background Red Delete Button */}
      <div className="absolute top-0 right-0 bottom-0 w-20 bg-danger flex items-center justify-center z-0">
        <button
          onClick={() => {
            removeFromCart(idx);
            setIsSwiped(false);
          }}
          className="w-full h-full text-white font-extrabold text-sm flex flex-col items-center justify-center gap-1 active:bg-danger"
        >
          <span className="text-lg">🗑️</span>
          <span>Xoá</span>
        </button>
      </div>

      {/* Main Sliding Content */}
      <div
        className="bg-surface-card p-3 transition-transform duration-300 relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-2 hover:bg-surface-secondary/30 active:bg-surface-secondary/50 transition-colors"
        style={{ transform: isSwiped ? "translateX(-80px)" : "translateX(0)" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Line 1 (Mobile) / Left Content (Desktop) */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Photo Thumbnail */}
          {currentProduct?.image_url ? (
            <img src={currentProduct.image_url} alt={item.product_name} className="w-12 h-12 rounded-lg bg-surface-secondary object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-surface-secondary flex items-center justify-center shrink-0 text-xl">
              ☕
            </div>
          )}
          
          {/* Name & Details */}
          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => currentProduct && openProductModal(currentProduct, idx)}>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <h4 className="font-bold text-text-primary text-sm leading-tight hover:text-primary transition-colors line-clamp-1">
                {item.product_name}
              </h4>
              <span className="text-[10px] font-semibold text-primary">Size {item.size_name}</span>
            </div>
            
            {/* Display modifiers list */}
            {item.modifiers.length > 0 && (
              <p className="text-[10px] text-text-secondary line-clamp-1 mt-0.5">
                + {Object.entries(
                  item.modifiers.reduce((acc: any, m: any) => {
                    acc[m.name] = (acc[m.name] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([name, count]: [string, any]) => `${count > 1 ? count + "x " : ""}${name}`).join(", ")}
              </p>
            )}

            {/* Discount Badges */}
            {(itemPromoDiscount > 0 || manualItemDiscount > 0) && (
              <div className="mt-1 flex flex-wrap gap-1">
                {itemPromoDiscount > 0 && (
                  <DiscountBadge kind={DISCOUNT_KIND.PROMO} label="Hệ thống" amount={itemPromoDiscount} />
                )}
                {manualItemDiscount > 0 && (
                  <DiscountBadge kind={DISCOUNT_KIND.MANUAL_ITEM} label="Thu ngân" amount={manualItemDiscount} />
                )}
              </div>
            )}
          </div>

          {/* Price (Mobile only, hidden on Desktop md) */}
          <div className="text-right shrink-0 md:hidden">
            {(itemPromoDiscount > 0 || manualItemDiscount > 0) && (
              <div className="text-[10px] text-text-muted line-through mb-0.5">
                {formatNumber(baseTotal)}
              </div>
            )}
            <div className="font-bold text-text-primary text-sm leading-tight">
              {formatNumber(Math.max(0, finalTotal - itemPromoDiscount))}
            </div>
          </div>
        </div>

        {/* Line 2 (Mobile) / Right Content (Desktop) */}
        <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-1 md:border-t-0 md:pt-0 md:mt-0 md:justify-end md:gap-4 shrink-0">
          
          {/* Quantity Controls */}
          <div className="flex items-center gap-2 bg-surface-secondary rounded-xl p-1">
            <button
              onClick={() => changeQty(idx, -1)}
              className="w-11 h-11 md:w-8 md:h-8 rounded-lg bg-surface-card active:bg-border md:hover:bg-border flex items-center justify-center text-text-primary font-bold shadow-sm transition-all active:scale-95 transform select-none"
            >
              -
            </button>
            <span className="text-sm font-semibold tabular-nums min-w-[2ch] text-center text-text-primary transition-transform duration-100 active:scale-90 transform select-none">{item.qty}</span>
            <button
              onClick={() => changeQty(idx, 1)}
              className="w-11 h-11 md:w-8 md:h-8 rounded-lg bg-surface-card active:bg-border md:hover:bg-border flex items-center justify-center text-text-primary font-bold shadow-sm transition-all active:scale-95 transform select-none"
            >
              +
            </button>
          </div>

          {/* Price & Remove (Desktop only) */}
          <div className="hidden md:flex items-center gap-4 text-right">
            <div>
              {(itemPromoDiscount > 0 || manualItemDiscount > 0) && (
                <div className="text-[10px] text-text-muted line-through mb-0.5">
                  {formatNumber(baseTotal)}
                </div>
              )}
              <div className="font-bold text-text-primary text-sm leading-tight tabular-nums">
                {formatNumber(Math.max(0, finalTotal - itemPromoDiscount))}
              </div>
            </div>

            <button
              onClick={() => removeFromCart(idx)}
              className="w-8 h-8 rounded-lg text-text-muted active:text-danger md:hover:text-danger active:bg-danger/10 md:hover:bg-danger/10 transition-colors flex items-center justify-center"
              aria-label="Xoá"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>

          {/* Mobile Remove Button (left side of Line 2) */}
          <button
            onClick={() => {
              if (isSwiped) {
                setIsSwiped(false);
              } else {
                setIsSwiped(true);
              }
            }}
            className="md:hidden text-xs text-danger font-semibold px-4 py-2 bg-danger/10 active:bg-danger/20 rounded-xl min-h-[44px] transition-colors"
          >
            Xoá
          </button>
        </div>
      </div>
    </div>
  );
}

