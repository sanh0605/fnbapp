import { parseApplicable, priceCart } from "../lib/sales/price-cart";
import type { PricePromotion } from "../lib/sales/price-cart";

// Replay: run priceCart on what each order stored and compare line by line (spec 2026-10-15, section 5).

export interface ReplayDiff {
  order_no: string;
  line_no: number;
  field: string;
  stored: number;
  computed: number;
}

const num = (v: unknown) => Number(v) || 0;
const parse = (v: unknown, fallback: any) => {
  if (typeof v !== "string") return v ?? fallback;
  try {
    return JSON.parse(v || "null") ?? fallback;
  } catch {
    return fallback;
  }
};

// Rows as findAllNoCache returns them (jsonb columns arrive as strings or objects).
// Migrated orders have a promotion id and an empty snapshot (296 of 831): they fall back to the promotion row as it is now.
export function replayOrder(order: any, lines: any[], promotionsById: Map<string, any> = new Map()): { lineCount: number; diffs: ReplayDiff[] } {
  let snap = parse(order.applied_promotion_snapshot_json, null);
  if (!snap?.id) snap = promotionsById.get(order.applied_promotion_id) ?? null;
  // Minimum is an eligibility rule the old server never checked; the replay takes the promotion as it was applied.
  const promotions: PricePromotion[] = snap?.id
    ? [{
        id: String(snap.id),
        code: String(snap.code || ""),
        type: snap.type === "ORDER_DISCOUNT" ? "ORDER_DISCOUNT" : "PRODUCT_DISCOUNT",
        discount_type: snap.discount_type,
        discount_value: num(snap.discount_value),
        applicable_products_json: typeof snap.applicable_products_json === "string" ? snap.applicable_products_json : JSON.stringify(snap.applicable_products_json ?? ""),
        min_order_value: 0,
        stackable: false,
      }]
    : [];

  const sorted = [...lines].sort((a, b) => num(a.line_no) - num(b.line_no));
  const mods = sorted.map((l) => parse(l.modifiers_snapshot_json, []) as { id: string; price: number; qty: number }[]);
  // Ids are made unique per line: a migrated order can hold one variant at two prices.
  const key = (i: number) => `L${i}`;
  const applicable = parseApplicable(promotions[0]?.applicable_products_json);
  if (promotions[0]) {
    promotions[0].applicable_products_json = JSON.stringify(
      Object.fromEntries(sorted.flatMap((l, i) => (applicable.has(String(l.variant_id)) ? [[key(i), applicable.get(String(l.variant_id))]] : []))),
    );
  }
  const priced = priceCart(
    sorted.map((l, i) => ({
      variant_id: key(i),
      qty: num(l.qty),
      modifiers: mods[i].map((m) => ({ modifier_id: `${key(i)}:${m.id}`, modifier_qty: num(m.qty) })),
      manual_item_discount: { value: num(l.manual_item_discount), type: "VND" },
    })),
    {
      variants: sorted.map((l, i) => ({ id: key(i), price: num(l.unit_price) })),
      modifiers: mods.flatMap((ms, i) => ms.map((m) => ({ id: `${key(i)}:${m.id}`, price: num(m.price) }))),
    },
    promotions,
    { value: num(order.manual_order_discount), type: "VND" },
  );

  const diffs: ReplayDiff[] = [];
  sorted.forEach((l, i) => {
    const c = priced.lines[i];
    const pairs: [string, number, number][] = [
      ["promo_discount", num(l.promo_discount), c.promo + c.orderPromo],
      ["manual_item_discount", num(l.manual_item_discount), c.manualItem],
      ["order_discount_allocation", num(l.order_discount_allocation), c.orderManual],
      ["net_line_total", num(l.net_line_total), c.net],
    ];
    for (const [field, stored, computed] of pairs) {
      if (stored !== computed) diffs.push({ order_no: order.order_no, line_no: num(l.line_no), field, stored, computed });
    }
  });
  return { lineCount: sorted.length, diffs };
}

export function replayOrders(orders: any[], lines: any[], promotions: any[] = []) {
  const promotionsById = new Map(promotions.map((p) => [p.id, p]));
  const byOrder = new Map<string, any[]>();
  for (const l of lines) byOrder.set(l.order_id, [...(byOrder.get(l.order_id) ?? []), l]);

  let lineCount = 0;
  const diffs: ReplayDiff[] = [];
  for (const o of orders) {
    const r = replayOrder(o, byOrder.get(o.id) ?? [], promotionsById);
    lineCount += r.lineCount;
    diffs.push(...r.diffs);
  }
  const orderNos = [...new Set(diffs.map((d) => d.order_no))];
  const badLines = new Set(diffs.map((d) => `${d.order_no}:${d.line_no}`)).size;
  return { lineCount, orderCount: orders.length, badLines, orderNos, diffs };
}
