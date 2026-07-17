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
    <div className="relative overflow-hidden rounded-xl border border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] transition-shadow transition-colors hover:border-indigo-300 bg-surface-card">
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
        className="bg-surface-card p-3 transition-transform duration-300 relative z-10"
        style={{ transform: isSwiped ? "translateX(-80px)" : "translateX(0)" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex justify-between items-start mb-2 cursor-pointer"
          onClick={() => currentProduct && openProductModal(currentProduct, idx)}
        >
          <div>
            <h4 className="font-bold text-text-primary leading-tight hover:text-primary transition-colors">
              {item.product_name} ✏️
            </h4>
            <p className="text-xs font-semibold text-primary mt-0.5">Size {item.size_name}</p>
          </div>
          <div className="text-right">
            {(itemPromoDiscount > 0 || manualItemDiscount > 0) && (
              <div className="text-[11px] text-text-muted line-through mb-0.5">
                {formatNumber(baseTotal)}
              </div>
            )}
            <div className="font-bold text-warning">
              {formatNumber(Math.max(0, finalTotal - itemPromoDiscount))}
            </div>
          </div>
        </div>

        {item.modifiers.length > 0 && (
          <div className="text-[11px] text-text-secondary bg-page p-1.5 rounded mb-2 leading-relaxed">
            {Object.entries(
              item.modifiers.reduce((acc: any, m: any) => {
                acc[m.name] = (acc[m.name] || 0) + 1;
                return acc;
              }, {})
            )
              .map(([name, count]: [string, any]) => `${count > 1 ? count + " x " : ""}${name}`)
              .join(", ")}
          </div>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          {itemPromoDiscount > 0 && (
            <DiscountBadge kind={DISCOUNT_KIND.PROMO} label="Hệ thống" amount={itemPromoDiscount} />
          )}
          {manualItemDiscount > 0 && (
            <DiscountBadge kind={DISCOUNT_KIND.MANUAL_ITEM} label="Thu ngân" amount={manualItemDiscount} />
          )}
        </div>

        <div className="flex justify-between items-center mt-2">
          <button
            onClick={() => {
              if (isSwiped) {
                setIsSwiped(false);
              } else {
                setIsSwiped(true);
              }
            }}
            className="text-xs text-danger font-medium px-2 py-1 bg-danger/10 rounded hover:bg-red-100"
          >
            Xoá
          </button>
          <div className="flex items-center gap-3 bg-surface-secondary rounded-lg p-1">
            <button
              onClick={() => changeQty(idx, -1)}
              className="w-6 h-6 flex items-center justify-center bg-surface-card rounded shadow-sm text-text-secondary font-bold"
            >
              -
            </button>
            <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
            <button
              onClick={() => changeQty(idx, 1)}
              className="w-6 h-6 flex items-center justify-center bg-surface-card rounded shadow-sm text-text-secondary font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

