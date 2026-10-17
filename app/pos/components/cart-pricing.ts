import { priceCart } from "@/lib/sales/price-cart";

export interface ItemLike {
  variant_id?: string;
  unit_price: number;
  qty: number;
  modifiers: { id?: string; price: number }[];
  discount_amount?: number;
  discount_type?: "VND" | "PERCENT";
}

/**
 * Calculates a single cart item's net total after manual item discount using
 * the canonical priceCart implementation from lib/sales/price-cart.ts.
 */
export function calculateItemTotal(item: ItemLike): number {
  const vId = item.variant_id || "v";
  const res = priceCart(
    [
      {
        variant_id: vId,
        qty: item.qty,
        modifiers: (item.modifiers || []).map((m, i) => ({
          modifier_id: m.id || String(i),
          modifier_qty: 1,
        })),
        manual_item_discount: {
          value: Number(item.discount_amount || 0),
          type: item.discount_type === "PERCENT" ? "PERCENT" : "VND",
        },
      },
    ],
    {
      variants: [{ id: vId, price: Number(item.unit_price) }],
      modifiers: (item.modifiers || []).map((m, i) => ({ id: m.id || String(i), price: Number(m.price) })),
    },
    [],
    null,
  );
  return res.total;
}

/**
 * Returns the line's gross price before discount: (unit_price + modifiers) * qty.
 */
export function calculateItemGross(item: {
  unit_price: number;
  qty: number;
  modifiers: { price: number }[];
}): number {
  const modsPrice = (item.modifiers || []).reduce((s, m) => s + Number(m.price || 0), 0);
  return (Number(item.unit_price) + modsPrice) * item.qty;
}

/**
 * Clamp while typing: amount 0 <= x <= subtotal, percent 0-100; negatives become 0.
 */
export function clampDiscount(
  value: number | null,
  type: "VND" | "PERCENT",
  subtotal: number,
): number | null {
  if (value === null || isNaN(value)) return null;
  const nonNegative = Math.max(0, value);
  if (type === "PERCENT") {
    return Math.min(100, nonNegative);
  }
  return Math.min(Math.max(0, subtotal), nonNegative);
}

/**
 * One-tap add of a size: merges into the first plain line of the same size
 * (no options, no item discount), otherwise appends a new line. Pure.
 */
export function addQuickLine(
  cart: any[],
  product: { id: string; name: string },
  variant: { id: string; size_name: string; price: number | string },
): any[] {
  const i = cart.findIndex(
    (l) => l.variant_id === variant.id && (l.modifiers ?? []).length === 0 && !l.discount_amount,
  );
  if (i >= 0) return cart.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
  return [
    ...cart,
    {
      id: crypto.randomUUID(),
      product_id: product.id,
      product_name: product.name,
      variant_id: variant.id,
      size_name: variant.size_name,
      unit_price: Number(variant.price),
      modifiers: [],
      qty: 1,
      discount_amount: 0,
      discount_type: "VND",
    },
  ];
}
