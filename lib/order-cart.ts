/**
 * Cart → OrderV2 + OrderLineV2[] transformation.
 *
 * Pure function. All reference data passed in via ReferenceData.
 * Internally calls assertOrderInvariants before returning, so any
 * caller of buildOrderFromCart is guaranteed to get an order+lines
 * pair that satisfies all 7 financial invariants.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (sections 5, 6)
 */

import crypto from "node:crypto";
import {
  buildProductSnapshot,
  buildVariantSnapshot,
  buildModifierSnapshotsFromCart,
  buildPromotionSnapshot,
} from "@/lib/order-snapshot";
import { allocateOrderDiscount, assertOrderInvariants } from "@/lib/order-math";
import { InvariantError, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/order-types";
import { resolveCapturedAt } from "@/lib/pos-captured-at";
import type {
  OrderV2,
  OrderLineV2,
  PromotionSnapshot,
  ProductSnapshot,
  VariantSnapshot,
  ModifierSnapshot,
} from "@/lib/order-types";

export interface CartItemInput {
  product_id: string;
  variant_id: string;
  qty: number;
  unit_price_snapshot?: number;
  promo_discount_snapshot?: number;
  modifiers: Array<{
    modifier_id: string;
    modifier_qty: number;
    modifier_name_snapshot?: string;
    modifier_price_snapshot?: number;
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
  // 2026-08-25 (docs/superpowers/plans/2026-08-24-outlets-and-order-code.md
  // section 3.2/6): set once at sale, never revisited (order-edit-cart.ts
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
  applied_promotion_id?: string | null; // explicit override; else auto-resolve
  suppress_auto_promotion?: boolean;
  actor: { id: string; name: string };
  // Captured client-side (new Date()) at the moment "Thanh toán" is
  // pressed, before any network call -- preserved across offline queueing
  // and retries so the recorded sale time is always when the button was
  // pressed, not when the request reached the server. Optional and
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
}

interface BuiltLine {
  spec: OrderLineV2;
  capacity: number; // gross - promo - manual_item
}

export interface BuildOrderResult {
  order: OrderV2;
  lines: OrderLineV2[];
  resolvedPromotion: PromotionSnapshot | null;
  payments: BuiltPayment[]; // empty when the order uses a single payment_method
}

export function buildOrderFromCart(input: CartInput, ref: ReferenceData): BuildOrderResult {
  if (!input.items || input.items.length === 0) {
    throw new InvariantError("Cart is empty");
  }

  const brand = ref.brands.find(b => b.id === input.brand_id);
  if (!brand) throw new InvariantError(`Unknown brand: ${input.brand_id}`);

  const { createdAt, rejected: capturedAtRejected } = resolveCapturedAt(input.client_captured_at);
  const orderId = `ord-${crypto.randomUUID()}`;

  // Resolve promotion (auto or explicit) against the true sale time, not
  // the clock at whatever moment this function actually runs -- for an
  // order queued offline and synced later, those can differ by hours.
  const resolvedPromo = resolvePromotion(input, ref, createdAt);
  const promoSnapshot = resolvedPromo ? buildPromotionSnapshot(resolvedPromo) : null;

  // Build line specs WITHOUT order_discount_allocation (computed below)
  const builtLines: BuiltLine[] = [];
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const line = buildLine(item, ref, orderId, i + 1, resolvedPromo);
    builtLines.push(line);
  }

  // Compute order-level gross, promo, manual_item
  const grossTotal = builtLines.reduce((s, l) => s + l.spec.gross_line_total, 0);
  const promoTotal = builtLines.reduce((s, l) => s + l.spec.promo_discount, 0);
  const manualItemTotal = builtLines.reduce((s, l) => s + l.spec.manual_item_discount, 0);

  // Compute manual_order_discount in VND
  const orderDiscountVnd = computeOrderDiscountVnd(input.manual_order_discount, grossTotal);

  // Allocate across lines
  const allocations = allocateOrderDiscount(
    builtLines.map(l => ({ line_id: l.spec.id, capacity: l.capacity })),
    orderDiscountVnd,
  );
  for (const l of builtLines) {
    const alloc = allocations.get(l.spec.id) || 0;
    l.spec.order_discount_allocation = alloc;
    l.spec.net_line_total = l.spec.gross_line_total - l.spec.promo_discount - l.spec.manual_item_discount - alloc;
  }

  // Cap order_discount at sum of allocations (in case discount > total capacity)
  const sumAlloc = builtLines.reduce((s, l) => s + l.spec.order_discount_allocation, 0);
  const finalOrderDiscount = Math.min(orderDiscountVnd, sumAlloc);

  const netTotal = builtLines.reduce((s, l) => s + l.spec.net_line_total, 0);

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
    completed_at: createdAt,
    voided_at: "",
    voided_by_id: "",
    void_reason: "",
    currency: "VND",
    gross_total: grossTotal,
    promo_discount_total: promoTotal,
    manual_item_discount_total: manualItemTotal,
    manual_order_discount: finalOrderDiscount,
    net_total: netTotal,
    applied_promotion_id: resolvedPromo?.id || "",
    applied_promotion_snapshot_json: promoSnapshot ? JSON.stringify(promoSnapshot) : "",
    pos_snapshot_json: JSON.stringify({ items: input.items, payment_method: input.payment_method }),
    payment_method: primaryPaymentMethod === "BANK_TRANSFER" ? PAYMENT_METHOD.BANK_TRANSFER : PAYMENT_METHOD.CASH,
    payment_ref: "",
    migration_notes: capturedAtRejected ? "client_captured_at_rejected" : "",
  };

  // Guardian: assert all 7 invariants before returning
  assertOrderInvariants(order, builtLines.map(l => l.spec));

  return {
    order,
    lines: builtLines.map(l => l.spec),
    resolvedPromotion: promoSnapshot,
    payments,
  };
}

// ============================================================
// Internal helpers
// ============================================================

function resolvePromotion(input: CartInput, ref: ReferenceData, asOf: string): any | null {
  if (input.suppress_auto_promotion) return null;

  const now = new Date(asOf);
  const eligible = ref.promotions.filter(p => {
    if (p.status !== "ACTIVE") return false;
    const start = new Date(p.start_date);
    const end = p.end_date ? new Date(p.end_date) : null;
    if (start > now) return false;
    if (end && end < now) return false;
    if (p.brand_id && p.brand_id !== input.brand_id) return false;
    return true;
  });

  // Explicit override by ID
  if (input.applied_promotion_id) {
    return eligible.find(p => p.id === input.applied_promotion_id) || null;
  }

  // Auto: pick the promo that gives the largest discount on this cart
  let bestPromo: any | null = null;
  let bestDiscount = 0;
  for (const p of eligible) {
    const d = estimatePromoDiscount(p, input.items, ref);
    if (d > bestDiscount) {
      bestDiscount = d;
      bestPromo = p;
    }
  }
  return bestPromo;
}

function estimatePromoDiscount(promo: any, items: CartItemInput[], ref: ReferenceData): number {
  let total = 0;
  if (promo.type === "PRODUCT_DISCOUNT") {
    const applicable = parseApplicable(promo.applicable_products_json);
    for (const item of items) {
      const variant = ref.variants.find(v => v.id === item.variant_id);
      if (!variant) continue;
      const unitPrice = Number(variant.price);
      const modsPrice = sumModifierPrices(item.modifiers, ref);
      const baseTotal = (unitPrice + modsPrice) * item.qty;

      if (applicable.has(item.variant_id)) {
        const targetPrice = applicable.get(item.variant_id) || Number(promo.discount_value);
        if (promo.discount_type === "FLAT_PRICE") {
          total += Math.max(0, (unitPrice - targetPrice) * item.qty);
        } else if (promo.discount_type === "PERCENT") {
          total += baseTotal * (Number(promo.discount_value) / 100);
        } else {
          total += Number(promo.discount_value) * item.qty;
        }
      }
    }
  }
  return total;
}

function parseApplicable(json: string | undefined): Map<string, number> {
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

function sumModifierPrices(mods: CartItemInput["modifiers"], ref: ReferenceData): number {
  let sum = 0;
  for (const m of mods) {
    const row = ref.modifiers.find((r: any) => r.id === m.modifier_id);
    const price = Number.isFinite(Number(m.modifier_price_snapshot))
      ? Number(m.modifier_price_snapshot)
      : Number(row?.price || 0);
    if (row || Number.isFinite(Number(m.modifier_price_snapshot))) {
      sum += price * Number(m.modifier_qty || 1);
    }
  }
  return sum;
}

function buildLine(
  item: CartItemInput,
  ref: ReferenceData,
  orderId: string,
  lineNo: number,
  resolvedPromo: any | null,
): BuiltLine {
  const product = ref.products.find(p => p.id === item.product_id);
  if (!product) throw new InvariantError(`Unknown product: ${item.product_id}`);

  const variant = ref.variants.find(v => v.id === item.variant_id);
  if (!variant) throw new InvariantError(`Unknown variant: ${item.variant_id}`);

  // docs/superpowers/plans/2026-08-29-product-stop-selling-and-real-delete.md
  // section 5.4/5b: this is the one choke point shared by POS checkout and
  // order-edit, so the "must not sell a paused product" guarantee belongs
  // here -- app/pos/page.tsx filtering status === "ACTIVE" only secures
  // what the screen offers, not a stale cart or an order queued offline
  // before the pause took effect. The message serves two readers: a
  // cashier seeing this immediately at checkout, and whoever later reads
  // Pos_Sync_Failures.error_message for an order that failed sync after
  // the item was paused mid-queue -- it covers both outcomes rather than
  // assuming one.
  if (product.status !== "ACTIVE" || variant.status !== "ACTIVE") {
    throw new InvariantError(
      `Món "${product.name} (${variant.size_name})" đã ngừng bán nên đơn này chưa được lưu. `
      + `Nếu đã giao hàng cho khách, hãy ghi nhận doanh thu thủ công; nếu chưa, hãy bỏ món này khỏi đơn rồi thử lại.`,
    );
  }

  const category = ref.categories.find(c => c.id === product.category_id) || null;

  const productSnap = buildProductSnapshot(product, category);
  const variantSnap = buildVariantSnapshot({
    ...variant,
    price: Number.isFinite(Number(item.unit_price_snapshot)) ? item.unit_price_snapshot : variant.price,
  });
  const modifierSnap = buildModifierSnapshotsFromCart(item.modifiers, ref.modifiers);

  // Recipes were removed from the sale path (Phase 2,
  // docs/superpowers/plans/2026-08-27-remove-recipes-and-semi-products.md).
  // recipe_snapshot_json itself stopped being written 2026-09-01
  // (docs/superpowers/plans/2026-08-31-remove-recipe-snapshots.md) -- no
  // one has read a line's own recipe_snapshot_json since Phase 2
  // (resolvedRecipes/order-cart.ts:225's old readback had 0 consumers
  // outside this file), so the inert shell this used to build is gone,
  // not just left empty. The column itself stays (NOT NULL, default
  // '{}'::jsonb) -- an empty string here becomes {} once it passes
  // through parseJsonColumns in pos-order-transaction.ts/
  // order-edit-transaction.ts, matching the column's own default.

  // Gross
  const gross = (variantSnap.price + modifierSnap.reduce((s, m) => s + m.price * m.qty, 0)) * item.qty;

  // Promo
  const promoDiscount = Number.isFinite(Number(item.promo_discount_snapshot))
    ? Math.min(gross, Math.max(0, Math.round(Number(item.promo_discount_snapshot))))
    : computePromoForLine(resolvedPromo, item, variantSnap, modifierSnap, gross);

  // Manual item (cap at gross - promo)
  const manualItemRaw = item.manual_item_discount.type === "PERCENT"
    ? Math.round(gross * (item.manual_item_discount.value / 100))
    : Math.round(item.manual_item_discount.value);
  const capacity = Math.max(0, gross - promoDiscount);
  const manualItem = Math.min(manualItemRaw, capacity);

  const spec: OrderLineV2 = {
    id: `ol-${crypto.randomUUID()}`,
    order_id: orderId,
    line_no: lineNo,
    product_id: item.product_id,
    product_snapshot_json: JSON.stringify(productSnap),
    variant_id: item.variant_id,
    variant_snapshot_json: JSON.stringify(variantSnap),
    qty: item.qty,
    unit_price: variantSnap.price,
    modifiers_snapshot_json: JSON.stringify(modifierSnap),
    gross_line_total: gross,
    promo_discount: promoDiscount,
    manual_item_discount: manualItem,
    order_discount_allocation: 0, // filled in by caller
    net_line_total: 0, // filled in by caller
    cost_at_sale: 0, // filled in by server action (Task 5)
    recipe_snapshot_json: "",
    promo_discount_reason: promoDiscount > 0 ? (resolvedPromo?.id || "SNAPSHOT") : "",
    manual_discount_reason: manualItem > 0 ? "MANUAL_CASHIER" : "",
  };

  return { spec, capacity: Math.max(0, gross - promoDiscount - manualItem) };
}

function computePromoForLine(
  promo: any | null,
  item: CartItemInput,
  variant: VariantSnapshot,
  modifiers: ModifierSnapshot[],
  gross: number,
): number {
  if (!promo || promo.type !== "PRODUCT_DISCOUNT") return 0;
  const applicable = parseApplicable(promo.applicable_products_json);
  if (!applicable.has(item.variant_id)) return 0;

  const targetPrice = applicable.get(item.variant_id) || Number(promo.discount_value);

  if (promo.discount_type === "FLAT_PRICE") {
    // Discount per unit = unit_price - target_price, applied to variant only (not modifiers)
    const perUnitDiscount = Math.max(0, variant.price - targetPrice);
    return Math.min(gross, perUnitDiscount * item.qty);
  }
  if (promo.discount_type === "PERCENT") {
    return Math.min(gross, Math.round(gross * (Number(promo.discount_value) / 100)));
  }
  // FLAT_VND per unit
  return Math.min(gross, Number(promo.discount_value) * item.qty);
}

function computeOrderDiscountVnd(
  input: { value: number; type: "VND" | "PERCENT" } | null | undefined,
  grossTotal: number,
): number {
  if (!input || input.value <= 0) return 0;
  if (input.type === "PERCENT") {
    return Math.round(grossTotal * (input.value / 100));
  }
  return Math.round(input.value);
}
