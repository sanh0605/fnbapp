/**
 * Cart → OrderV2 + OrderLineV2[] transformation.
 *
 * Pure function. All reference data passed in via ReferenceData.
 * Internally calls assertOrderInvariants before returning, so any
 * caller of buildOrderFromCart is guaranteed to get an order+lines
 * pair that satisfies all 7 financial invariants.
 *
 * (sections 5, 6)
 */

import crypto from "node:crypto";
import {
  buildProductSnapshot,
  buildVariantSnapshot,
  buildModifierSnapshotsFromCart,
  buildPromotionSnapshot,
} from "@/lib/sales/order-snapshot";
import { assertOrderInvariants } from "@/lib/sales/order-math";
import { eligiblePromotionSets, priceAsOf, priceCart, toPricePromotion } from "@/lib/sales/price-cart";
import type { PriceCartCatalog, PriceCartItem, PricePromotion } from "@/lib/sales/price-cart";
import { InvariantError, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/sales/order-types";
import { resolveCapturedAt } from "@/lib/sales/pos-captured-at";
import type {
  OrderV2,
  OrderLineV2,
  PromotionSnapshot,
} from "@/lib/sales/order-types";

export interface CartItemInput {
  product_id: string;
  variant_id: string;
  qty: number;
  modifiers: Array<{
    modifier_id: string;
    modifier_qty: number;
    modifier_name_snapshot?: string;
  }>;
  manual_item_discount: { value: number; type: "VND" | "PERCENT" };
}

export interface CartPaymentInput {
  method: "CASH" | "BANK_TRANSFER";
  amount: number;
  reference?: string;
}

export interface CartInput {
  brand_id: string;
  // 2026-08-25 (section 3.2/6): set once at sale, never revisited (order-edit-cart.ts
  // preserves it explicitly, the same way created_at already is). The
  // server derives and trusts brand_id from this, not the reverse --
  // submitOrderV2 overwrites whatever brand_id the client sent with the
  // outlet's own brand before this function ever sees it.
  outlet_id: string;
  items: CartItemInput[];
  payment_method: "CASH" | "BANK_TRANSFER";
  // Optional split/mixed payment (e.g. part cash, part bank transfer). When
  // provided with 2+ entries, this becomes the source of truth for how the
  // order was paid instead of the single payment_method field; the amounts
  // must sum to exactly the order's net_total.
  payments?: CartPaymentInput[];
  manual_order_discount?: { value: number; type: "VND" | "PERCENT" } | null;
  applied_promotion_id?: string | null; // sent by the till, ignored: the server takes promotion_ids
  promo_code?: string; // a promotion with a code applies only when this matches it
  // What the till chose and showed (BR-SALE-008). The POS action refuses a request without them.
  promotion_ids?: string[];
  shown_total?: number;
  actor: { id: string; name: string };
  // Captured client-side (new Date()) at the moment "Thanh toán" is
  // pressed, before any network call -- preserved across "Gửi lại" so the
  // recorded sale time is when the button was pressed, not when the
  // request reached the server. Optional and
  // defaults to server time for any caller that doesn't send it.
  client_captured_at?: string;
}

export interface BuiltPayment {
  id: string;
  method: string;
  amount: number;
  reference: string;
}

export interface ReferenceData {
  brands: any[];
  products: any[];
  variants: any[];
  categories: any[];
  modifiers: any[];
  promotions: any[];
  // product_price_history rows: a late order is priced at the price of its own moment.
  priceHistory?: any[];
}

export const PRICE_CHANGED = "Giá hoặc khuyến mãi đã thay đổi. Tải lại trang rồi bấm lại.";

export interface BuiltOrderPromotion {
  promotion_id: string;
  seq: number;
  name: string;
  code: string;
  type: string;
  discount_type: string;
  discount_value: number;
  stackable: boolean;
  amount: number;
}

export interface BuildOrderResult {
  order: OrderV2;
  lines: OrderLineV2[];
  resolvedPromotion: PromotionSnapshot | null;
  payments: BuiltPayment[]; // empty when the order uses a single payment_method
  orderPromotions: BuiltOrderPromotion[]; // one per promotion that took money off
}

export function buildOrderFromCart(input: CartInput, ref: ReferenceData): BuildOrderResult {
  if (!input.items || input.items.length === 0) {
    throw new InvariantError("Cart is empty");
  }

  const brand = ref.brands.find(b => b.id === input.brand_id);
  if (!brand) throw new InvariantError(`Unknown brand: ${input.brand_id}`);

  const { createdAt, rejected: capturedAtRejected } = resolveCapturedAt(input.client_captured_at);
  const orderId = `ord-${crypto.randomUUID()}`;

  if (ref.priceHistory) {
    ref = { ...ref, variants: ref.variants.map(v => ({ ...v, price: priceAsOf(ref.priceHistory!, v.id, Number(v.price), createdAt) })) };
  }
  const prepared = input.items.map(item => prepareLine(item, ref));
  const items = input.items.map((item, i) => ({
    variant_id: item.variant_id,
    qty: item.qty,
    modifiers: prepared[i].modifierSnap.map(m => ({ modifier_id: m.id, modifier_qty: m.qty })),
    manual_item_discount: item.manual_item_discount,
  }));
  const catalog = {
    variants: prepared.map(p => ({ id: p.variantSnap.id, price: p.variantSnap.price })),
    modifiers: prepared.flatMap(p => p.modifierSnap.map(m => ({ id: m.id, price: m.price }))),
  };

  // Resolve promotion (auto or explicit) against the true sale time, not
  // the clock at whatever moment this function actually runs -- a "Gửi lại"
  // can arrive later.
  const candidates = resolvePromotions(input, ref, createdAt, items, catalog);
  const priced = priceCart(items, catalog, candidates.map(toPricePromotion), input.manual_order_discount ?? null);
  if (input.shown_total !== undefined && input.shown_total !== priced.total) {
    throw new InvariantError(PRICE_CHANGED);
  }
  const orderPromotions = priced.applied.map((a, i): BuiltOrderPromotion => {
    const p = candidates.find(c => c.id === a.promotionId);
    return {
      promotion_id: a.promotionId,
      seq: i + 1,
      name: String(p.name || ""),
      code: p.code || "",
      type: p.type === "ORDER_DISCOUNT" ? "ORDER_DISCOUNT" : "PRODUCT_DISCOUNT",
      discount_type: p.discount_type,
      discount_value: Number(p.discount_value),
      stackable: p.stackable === true,
      amount: a.amount,
    };
  });
  // The first promotion that took money keeps the two legacy order columns filled.
  const resolvedPromo = candidates.find(c => c.id === priced.applied[0]?.promotionId) ?? null;
  const promoSnapshot = resolvedPromo ? buildPromotionSnapshot(resolvedPromo) : null;

  const lines: OrderLineV2[] = prepared.map((p, i) => {
    const l = priced.lines[i];
    const promo = l.promo + l.orderPromo;
    return {
      id: `ol-${crypto.randomUUID()}`,
      order_id: orderId,
      line_no: i + 1,
      product_id: input.items[i].product_id,
      product_snapshot_json: JSON.stringify(p.productSnap),
      variant_id: input.items[i].variant_id,
      variant_snapshot_json: JSON.stringify(p.variantSnap),
      qty: input.items[i].qty,
      unit_price: p.variantSnap.price,
      modifiers_snapshot_json: JSON.stringify(p.modifierSnap),
      gross_line_total: l.gross,
      promo_discount: promo,
      manual_item_discount: l.manualItem,
      order_discount_allocation: l.orderManual,
      net_line_total: l.net,
      promo_discount_reason: promo > 0 ? (resolvedPromo?.id || "") : "",
    };
  });
  const sum = (f: (l: OrderLineV2) => number) => lines.reduce((s, l) => s + f(l), 0);
  const grossTotal = sum(l => l.gross_line_total);
  const promoTotal = sum(l => l.promo_discount);
  const manualItemTotal = sum(l => l.manual_item_discount);
  const finalOrderDiscount = sum(l => l.order_discount_allocation);
  const netTotal = priced.total;

  const payments: BuiltPayment[] = [];
  if (input.payments && input.payments.length > 0) {
    const paymentSum = input.payments.reduce((s, p) => s + p.amount, 0);
    if (paymentSum !== netTotal) {
      throw new InvariantError(
        `Payment total ${paymentSum} does not match order net_total ${netTotal}`,
      );
    }
    for (const p of input.payments) {
      if (p.amount <= 0) {
        throw new InvariantError("Each payment amount must be greater than 0");
      }
      payments.push({
        id: `pay-${crypto.randomUUID()}`,
        method: p.method,
        amount: p.amount,
        reference: p.reference || "",
      });
    }
  }

  // The single-method field stays populated for backward compatibility with
  // existing reports/reads; order_payments (built above when split) is the
  // detailed, per-method source of truth going forward.
  const primaryPaymentMethod = payments.length > 0 ? payments[0].method : input.payment_method;

  const order: OrderV2 = {
    id: orderId,
    order_no: "", // assigned by server action after row reservation
    brand_id: input.brand_id,
    outlet_id: input.outlet_id,
    status: ORDER_STATUS.COMPLETED,
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: createdAt,
    created_by_id: input.actor.id,
    created_by_name: input.actor.name,
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    gross_total: grossTotal,
    promo_discount_total: promoTotal,
    manual_item_discount_total: manualItemTotal,
    manual_order_discount: finalOrderDiscount,
    net_total: netTotal,
    applied_promotion_id: resolvedPromo?.id || "",
    applied_promotion_snapshot_json: promoSnapshot ? JSON.stringify(promoSnapshot) : "",
    payment_method: primaryPaymentMethod === "BANK_TRANSFER" ? PAYMENT_METHOD.BANK_TRANSFER : PAYMENT_METHOD.CASH,
    migration_notes: capturedAtRejected ? "client_captured_at_rejected" : "",
  };

  // Guardian: assert all 7 invariants before returning
  assertOrderInvariants(order, lines, orderPromotions);

  return {
    order,
    lines,
    resolvedPromotion: promoSnapshot,
    payments,
    orderPromotions,
  };
}

// ============================================================
// Internal helpers
// ============================================================


// The sent set must be exactly one of the valid sets, never re-picked here (BR-SALE-008).
function resolvePromotions(input: CartInput, ref: ReferenceData, asOf: string, items: PriceCartItem[], catalog: PriceCartCatalog): any[] {
  if (input.promotion_ids === undefined) return []; // the POS action refuses such a request before this
  const sent = Array.isArray(input.promotion_ids) ? [...input.promotion_ids].sort().join("|") : null;
  const sets = eligiblePromotionSets(ref.promotions, items, catalog, asOf, input.brand_id, input.promo_code ?? null);
  const set = sets.find(s => [...s.promotionIds].sort().join("|") === sent);
  // Nothing sent is right only when nothing was eligible.
  if (!set && (sets.length > 0 || sent !== "")) throw new InvariantError(PRICE_CHANGED);
  return set ? ref.promotions.filter(p => set.promotionIds.includes(p.id)) : [];
}

function prepareLine(item: CartItemInput, ref: ReferenceData) {
  const product = ref.products.find(p => p.id === item.product_id);
  if (!product) throw new InvariantError(`Unknown product: ${item.product_id}`);

  const variant = ref.variants.find(v => v.id === item.variant_id);
  if (!variant) throw new InvariantError(`Unknown variant: ${item.variant_id}`);

  // section 5.4/5b: this is the one choke point shared by POS checkout and
  // order-edit, so the "must not sell a paused product" guarantee belongs
  // here -- app/pos/page.tsx filtering
  // status === "ACTIVE" only secures what the screen offers, not a stale cart.
  if (product.status !== "ACTIVE" || variant.status !== "ACTIVE") {
    throw new InvariantError(
      `Món "${product.name} (${variant.size_name})" đã ngừng bán nên đơn này chưa được lưu. `
      + `Nếu đã giao hàng cho khách, hãy ghi nhận doanh thu thủ công; nếu chưa, hãy bỏ món này khỏi đơn rồi thử lại.`,
    );
  }

  // The cart comes from the browser: refuse numbers that would make a negative line.
  if (!Number.isInteger(item.qty) || item.qty < 1) {
    throw new InvariantError("Số lượng món phải là số nguyên dương");
  }
  if (!(item.manual_item_discount.value >= 0)) {
    throw new InvariantError("Giảm giá món không được âm");
  }

  const category = ref.categories.find(c => c.id === product.category_id) || null;

  const productSnap = buildProductSnapshot(product, category);
  const variantSnap = buildVariantSnapshot(variant);
  const modifierSnap = buildModifierSnapshotsFromCart(item.modifiers, ref.modifiers);

  return { productSnap, variantSnap, modifierSnap };
}
