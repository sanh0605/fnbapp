"use client";

import { DiscountBadge, DISCOUNT_KIND } from "./DiscountBadge";

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
    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm transition-all hover:border-indigo-300">
      <div
        className="flex justify-between items-start mb-2 cursor-pointer"
        onClick={() => currentProduct && openProductModal(currentProduct, idx)}
      >
        <div>
          <h4 className="font-bold text-gray-800 leading-tight hover:text-indigo-600 transition-colors">
            {item.product_name} ✏️
          </h4>
          <p className="text-xs font-semibold text-indigo-600 mt-0.5">Size {item.size_name}</p>
        </div>
        <div className="text-right">
          {(itemPromoDiscount > 0 || manualItemDiscount > 0) && (
            <div className="text-[11px] text-gray-400 line-through mb-0.5">
              {baseTotal.toLocaleString("vi-VN")}
            </div>
          )}
          <div className="font-bold text-orange-600">
            {Math.max(0, finalTotal - itemPromoDiscount).toLocaleString("vi-VN")}
          </div>
        </div>
      </div>

      {item.modifiers.length > 0 && (
        <div className="text-[11px] text-gray-500 bg-gray-50 p-1.5 rounded mb-2 leading-relaxed">
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
          onClick={() => removeFromCart(idx)}
          className="text-xs text-red-500 font-medium px-2 py-1 bg-red-50 rounded hover:bg-red-100"
        >
          Xoá
        </button>
        <div className="flex items-center gap-3 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => changeQty(idx, -1)}
            className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 font-bold"
          >
            -
          </button>
          <span className="text-sm font-bold w-4 text-center">{item.qty}</span>
          <button
            onClick={() => changeQty(idx, 1)}
            className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-gray-600 font-bold"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
