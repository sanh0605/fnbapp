/**
 * The one place an order's money is worked out (BR-SALE-008 to -011).
 * Pure: no server imports, so the till and the server run the same file.
 * Prices come from the catalogue only. Rounding is Math.round, here and nowhere else.
 */

import { allocateOrderDiscount } from "@/lib/sales/order-math";

type Discount = { value: number; type: "VND" | "PERCENT" };

export interface PriceCartItem {
  variant_id: string;
  qty: number;
  modifiers: { modifier_id: string; modifier_qty: number }[];
  manual_item_discount: Discount;
}
export interface PriceCartCatalog {
  variants: { id: string; price: number }[];
  modifiers: { id: string; price: number }[];
}
export interface PricePromotion {
  id: string;
  code: string;
  type: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  discount_type: "PERCENT" | "FLAT_VND" | "FLAT_PRICE";
  discount_value: number;
  applicable_products_json: string;
  min_order_value: number;
  stackable: boolean;
}
export interface PricedLine {
  gross: number;
  promo: number;
  manualItem: number;
  orderPromo: number;
  orderManual: number;
  net: number;
}
export interface PriceCartResult {
  lines: PricedLine[];
  applied: { promotionId: string; amount: number }[];
  total: number;
}

// Dish list as an array of ids (shared value) or an object id -> per-size value.
export function parseApplicable(json: string | undefined): Map<string, number> {
  const result = new Map<string, number>();
  if (!json) return result;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      for (const id of parsed) result.set(String(id), 0);
    } else if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed)) result.set(k, Number(v));
    }
  } catch {}
  return result;
}

export function toPricePromotion(p: any): PricePromotion {
  return {
    id: p.id,
    code: p.code || "",
    type: p.type === "ORDER_DISCOUNT" ? "ORDER_DISCOUNT" : "PRODUCT_DISCOUNT",
    discount_type: p.discount_type,
    discount_value: Number(p.discount_value),
    applicable_products_json: p.applicable_products_json || "",
    min_order_value: Number(p.min_order_value) || 0,
    stackable: p.stackable === true,
  };
}

// promotions = the set to apply, already chosen and checked for dates, brand and code by the caller.
// Minimum order value is checked here because it depends on the base worked out below.
// orderPromo is booked into the line's promo_discount by the caller; kept apart so the replay can compare.
export function priceCart(
  items: PriceCartItem[],
  catalog: PriceCartCatalog,
  promotions: PricePromotion[],
  manualOrderDiscount: Discount | null,
): PriceCartResult {
  const variantPrice = (id: string) => catalog.variants.find((v) => v.id === id)?.price ?? 0;
  const modifierPrice = (id: string) => catalog.modifiers.find((m) => m.id === id)?.price ?? 0;
  const gross = items.map(
    (it) => (variantPrice(it.variant_id) + it.modifiers.reduce((s, m) => s + modifierPrice(m.modifier_id) * m.modifier_qty, 0)) * it.qty,
  );

  // Dish promotions then the cashier's dish discount, each capped at what the line has left.
  const dishStep = (promos: PricePromotion[]) => {
    const perPromo = promos.map(() => 0);
    const lines = items.map((it, i) => {
      let promo = 0;
      promos.forEach((p, k) => {
        const value = parseApplicable(p.applicable_products_json).get(it.variant_id);
        if (value === undefined) return;
        const v = value || p.discount_value; // 0 means "no per-size value"
        const raw = p.discount_type === "FLAT_PRICE" ? Math.max(0, variantPrice(it.variant_id) - v) * it.qty
          : p.discount_type === "PERCENT" ? Math.round((gross[i] * v) / 100)
          : v * it.qty;
        const amount = Math.min(raw, gross[i] - promo);
        perPromo[k] += amount;
        promo += amount;
      });
      const m = it.manual_item_discount;
      const manualRaw = m.type === "PERCENT" ? Math.round((gross[i] * m.value) / 100) : Math.round(m.value);
      return { promo, manualItem: Math.min(manualRaw, Math.max(0, gross[i] - promo)) };
    });
    const base = lines.reduce((s, l, i) => s + gross[i] - l.promo - l.manualItem, 0);
    return { lines, perPromo, base };
  };

  let dishPromos = promotions.filter((p) => p.type === "PRODUCT_DISCOUNT");
  let dish = dishStep(dishPromos);
  const kept = dishPromos.filter((p) => p.min_order_value <= dish.base);
  if (kept.length !== dishPromos.length) {
    dishPromos = kept;
    dish = dishStep(dishPromos);
  }

  // Whole-order promotions on the base, then the cashier's whole-order discount on what is left.
  let left = dish.base;
  const orderPromos = promotions
    .filter((p) => p.type === "ORDER_DISCOUNT" && p.min_order_value <= dish.base)
    .map((p) => {
      const raw = p.discount_type === "PERCENT" ? Math.round((dish.base * p.discount_value) / 100)
        : p.discount_type === "FLAT_VND" ? p.discount_value
        : 0;
      const amount = Math.min(raw, left);
      left -= amount;
      return { promotionId: p.id, amount };
    });
  const spread = (lines: { capacity: number }[], amount: number) => {
    const alloc = allocateOrderDiscount(lines.map((l, i) => ({ line_id: String(i), capacity: l.capacity })), amount);
    return lines.map((_, i) => alloc.get(String(i)) ?? 0);
  };
  const orderPromoTotal = dish.base - left;
  const orderPromoLine = spread(dish.lines.map((l, i) => ({ capacity: gross[i] - l.promo - l.manualItem })), orderPromoTotal);

  const mo = manualOrderDiscount;
  const manualTotal = !mo || mo.value <= 0 ? 0 : mo.type === "PERCENT" ? Math.round((left * mo.value) / 100) : Math.round(mo.value);
  const orderManualLine = spread(
    dish.lines.map((l, i) => ({ capacity: gross[i] - l.promo - l.manualItem - orderPromoLine[i] })),
    manualTotal,
  );

  const lines = dish.lines.map((l, i): PricedLine => ({
    gross: gross[i],
    promo: l.promo,
    manualItem: l.manualItem,
    orderPromo: orderPromoLine[i],
    orderManual: orderManualLine[i],
    net: gross[i] - l.promo - l.manualItem - orderPromoLine[i] - orderManualLine[i],
  }));
  const applied = [
    ...dishPromos.map((p, k) => ({ promotionId: p.id, amount: dish.perPromo[k] })),
    ...orderPromos,
  ].filter((a) => a.amount > 0);
  return { lines, applied, total: lines.reduce((s, l) => s + l.net, 0) };
}


// Open for the sale moment and the brand: ACTIVE, inside its dates (spec 4.2).
export function isOpenFor(p: any, at: string, brandId: string): boolean {
  const now = new Date(at);
  if (p.status !== "ACTIVE" || new Date(p.start_date) > now) return false;
  if (p.end_date && new Date(p.end_date) < now) return false;
  return !p.brand_id || p.brand_id === brandId;
}

interface PromotionSet { promotionIds: string[]; amount: number }

// The valid sets for a cart (spec 4.2): each promotion not marked Dùng chung alone, and all the
// Dùng chung ones together. Biggest discount first. Coded promotions count only once their code is typed.
export function eligiblePromotionSets(
  promotions: any[],
  items: PriceCartItem[],
  catalog: PriceCartCatalog,
  at: string,
  brandId: string,
  code: string | null,
): PromotionSet[] {
  const typed = code?.trim().toLowerCase() ?? "";
  const amountOf = (set: any[]) =>
    priceCart(items, catalog, set.map(toPricePromotion), null).applied.reduce((s, a) => s + a.amount, 0);
  const eligible = promotions.filter(
    (p) => isOpenFor(p, at, brandId)
      && (!String(p.code ?? "").trim() || String(p.code).trim().toLowerCase() === typed)
      && amountOf([p]) > 0,
  );
  const shared = eligible.filter((p) => p.stackable === true);
  const groups = [...eligible.filter((p) => p.stackable !== true).map((p) => [p]), ...(shared.length ? [shared] : [])];
  return groups
    .map((g) => ({ promotionIds: g.map((p) => p.id as string), amount: amountOf(g) }))
    .sort((a, b) => b.amount - a.amount);
}

// A late order is priced at its own moment: the old price of the first change after that moment.
export function priceAsOf(history: any[], variantId: string, current: number, at: string): number {
  const t = new Date(at).getTime();
  const next = history
    .filter((h) => h.variant_id === variantId && h.old_price != null && new Date(h.effective_at).getTime() > t)
    .sort((a, b) => new Date(a.effective_at).getTime() - new Date(b.effective_at).getTime())[0];
  return next ? Number(next.old_price) : current;
}
