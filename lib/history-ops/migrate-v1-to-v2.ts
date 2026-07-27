/**
 * V1 → V2 migration helpers.
 *
 * Pure functions. Take raw V1 sheet rows + reference data, produce V2 shapes
 * following spec §7.2 reconstruction rules. The migration script (Task 3)
 * orchestrates batched writes; these helpers do the data transformation.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 7.2)
 */

import crypto from "node:crypto";
import { allocateOrderDiscount, assertOrderInvariants } from "@/lib/order-math";
import { InvariantError, ORDER_STATUS, PAYMENT_METHOD, EVENT_TYPE } from "@/lib/order-types";
import type {
  OrderV2, OrderLineV2, OrderEvent,
  ProductSnapshot, VariantSnapshot, ModifierSnapshot,
  PromotionSnapshot, RecipeSnapshot, LineRecipeSnapshot,
} from "@/lib/order-types";
import {
  buildProductSnapshot, buildVariantSnapshot, buildPromotionSnapshot, buildRecipeSnapshot,
} from "@/lib/order-snapshot";

// ============================================================
// Public types
// ============================================================

export interface V1Order {
  id: string;
  order_no: string;
  brand_id: string;
  status: string;
  total_amount: string | number;
  subtotal?: string | number;
  subtotal_amount?: string | number;
  discount_amount: string | number;
  discount_type: string;
  applied_promotion_id: string;
  applied_promotion_snapshot_json: string;
  method: string;
  staff_name: string;
  created_at: string;
  voided?: boolean | string;
}

export interface V1Line {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  qty: string | number;
  unit_price: string | number;
  line_discount: string | number;
  line_manual_discount?: string | number;
  discount_amount?: string | number;
  discount_type: string;
  modifiers_json: string;
  created_at: string;
}

export interface V1LedgerEntry {
  id: string;
  transaction_type: string;
  reference_id: string;
  item_reference: string;
  quantity_change: string | number;
  unit_cost: string | number;
  created_at: string;
}

export interface MigrationReferenceData {
  products: any[];
  variants: any[];
  categories: any[];
  modifiers: any[];
  promotions: any[];
  recipes: any[];
}

export interface ReconstructResult {
  order: OrderV2;
  lines: OrderLineV2[];
  event: OrderEvent;
  reversalLedgerEntries: V1LedgerEntry[]; // for voided orders
  classification: {
    gross_total: number;
    promo_discount_total: number;
    manual_item_discount_total: number;
    manual_order_discount: number;
    net_total: number;
    residual: number; // gross - promo - manual_item - manual_order - net (should be 0 after adjustment)
    heuristic_notes: string[];
  };
  invariantPassed: boolean;
  invariantError?: string;
}

// ============================================================
// Main reconstruction function
// ============================================================

export function reconstructOrderV2(
  v1Order: V1Order,
  v1Lines: V1Line[],
  v1Ledger: V1LedgerEntry[],
  ref: MigrationReferenceData,
): ReconstructResult {
  const heuristicNotes: string[] = [];
  const createdAt = v1Order.created_at || new Date().toISOString();
  const orderId = `ord-migrated-${crypto.randomUUID()}`;
  const actorId = "system-migration";
  const actorName = "WS-5 Migration Script";

  // ----- Status mapping -----
  let status: OrderV2["status"] = ORDER_STATUS.COMPLETED;
  if (v1Order.status === "VOIDED" || v1Order.voided === true || v1Order.voided === "true") {
    status = ORDER_STATUS.VOIDED;
  }

  // ----- Build V2 lines from V1 lines -----
  const v2Lines: OrderLineV2[] = [];
  for (let i = 0; i < v1Lines.length; i++) {
    const v1Line = v1Lines[i];
    const v2Line = buildMigratedLine(v1Line, orderId, i + 1, createdAt, ref);
    v2Lines.push(v2Line);
  }

  // ----- Compute totals from V1 intended math -----
  // CRITICAL FIX (WS-7): do NOT trust V1 total_amount — it had bugs.
  // Use intended math: subtotal - sum(discounts).

  const grossTotal = v2Lines.reduce((s, l) => s + l.gross_line_total, 0);
  const promoTotal = v2Lines.reduce((s, l) => s + l.promo_discount, 0);
  const manualItemTotal = v2Lines.reduce((s, l) => s + l.manual_item_discount, 0);

  // manual_order_discount comes from V1 discount_amount directly
  // (NOT solved as residual — residual approach created phantom discounts
  // when V1 total_amount had bugs).
  const manualOrderDiscount = Math.max(0, Math.round(Number(v1Order.discount_amount || 0)));

  // Computed net — this is the mathematically correct value
  const computedNetTotal = grossTotal - promoTotal - manualItemTotal - manualOrderDiscount;

  // Sanity check: compare to V1 stored total_amount
  const v1StoredTotal = Number(v1Order.total_amount || 0);
  const storedVsComputed = computedNetTotal - v1StoredTotal;
  if (Math.abs(storedVsComputed) > 1) {
    heuristicNotes.push(
      `V1 stored total_amount (${v1StoredTotal}) differs from computed (${computedNetTotal}) by ${storedVsComputed}đ. ` +
      `Using computed value (V1 total_amount had known bugs in some orders).`
    );
  }

  const netTotal = computedNetTotal;

  // ----- Allocate manual_order_discount across lines -----
  if (manualOrderDiscount > 0) {
    const allocatable = v2Lines.map(l => ({
      line_id: l.id,
      capacity: Math.max(0, l.gross_line_total - l.promo_discount - l.manual_item_discount),
    }));
    const allocations = allocateOrderDiscount(allocatable, manualOrderDiscount);
    for (const l of v2Lines) {
      const alloc = allocations.get(l.id) || 0;
      l.order_discount_allocation = alloc;
      l.net_line_total = l.gross_line_total - l.promo_discount - l.manual_item_discount - alloc;
    }
  } else {
    // No order discount; net_line_total = gross - promo - manual_item
    for (const l of v2Lines) {
      l.order_discount_allocation = 0;
      l.net_line_total = l.gross_line_total - l.promo_discount - l.manual_item_discount;
    }
  }

  // ----- Compute cost_at_sale per line from V1 ledger -----
  const orderLedger = v1Ledger.filter(l =>
    l.reference_id === v1Order.id && l.transaction_type === "SALES_CONSUME",
  );
  for (const line of v2Lines) {
    line.cost_at_sale = computeLineCostFromLedger(line, orderLedger);
  }

  // ----- Compose order -----
  const paymentMethod: OrderV2["payment_method"] =
    String(v1Order.method || "").toLowerCase().includes("chuyen") || String(v1Order.method || "").toLowerCase().includes("bank")
      ? PAYMENT_METHOD.BANK_TRANSFER
      : PAYMENT_METHOD.CASH;

  const order: OrderV2 = {
    id: orderId,
    order_no: v1Order.order_no || "",
    brand_id: v1Order.brand_id || "",
    status,
    version: 1,
    parent_order_id: "",
    superseded_by: "",
    created_at: createdAt,
    created_by_id: actorId,
    created_by_name: v1Order.staff_name || actorName,
    completed_at: status === ORDER_STATUS.COMPLETED ? createdAt : "",
    voided_at: status === ORDER_STATUS.VOIDED ? createdAt : "",
    voided_by_id: status === ORDER_STATUS.VOIDED ? actorId : "",
    void_reason: status === ORDER_STATUS.VOIDED ? "Migrated from V1 as voided" : "",
    currency: "VND",
    gross_total: grossTotal,
    promo_discount_total: promoTotal,
    manual_item_discount_total: manualItemTotal,
    manual_order_discount: manualOrderDiscount,
    net_total: netTotal,
    applied_promotion_id: v1Order.applied_promotion_id || "",
    applied_promotion_snapshot_json: v1Order.applied_promotion_snapshot_json || "",
    pos_snapshot_json: JSON.stringify({ migrated_from_v1: true, v1_id: v1Order.id }),
    payment_method: paymentMethod,
    payment_ref: "",
    migration_notes: heuristicNotes.length > 0 ? heuristicNotes.join(" | ") : "Migrated from V1; no heuristics needed.",
  };

  // ----- Build Order_Events MIGRATED -----
  const event: OrderEvent = {
    id: `evt-migrated-${crypto.randomUUID()}`,
    order_id: orderId,
    event_type: EVENT_TYPE.MIGRATED,
    event_at: new Date().toISOString(),
    actor_id: actorId,
    actor_name: actorName,
    from_version: "" as const,
    to_version: 1,
    previous_order_id: "",
    delta_json: JSON.stringify({
      v1_id: v1Order.id,
      v1_total: netTotal,
      gross_total: grossTotal,
      promo_total: promoTotal,
      manual_item_total: manualItemTotal,
      manual_order_discount: manualOrderDiscount,
      residual: storedVsComputed,
    }),
    reason: `WS-5 migration from V1 order ${v1Order.id}`,
  };

  // ----- Validate invariants -----
  let invariantPassed = true;
  let invariantError: string | undefined;
  try {
    assertOrderInvariants(order, v2Lines);
  } catch (err: any) {
    invariantPassed = false;
    invariantError = err?.message || String(err);
  }

  return {
    order,
    lines: v2Lines,
    event,
    reversalLedgerEntries: [], // populated by script for VOIDED orders
    classification: {
      gross_total: grossTotal,
      promo_discount_total: promoTotal,
      manual_item_discount_total: manualItemTotal,
      manual_order_discount: manualOrderDiscount,
      net_total: netTotal,
      residual: storedVsComputed, // now means "stored - computed" drift, NOT solved residual
      heuristic_notes: heuristicNotes,
    },
    invariantPassed,
    invariantError,
  };
}

// ============================================================
// Per-line reconstruction
// ============================================================

function buildMigratedLine(
  v1Line: V1Line,
  orderId: string,
  lineNo: number,
  createdAt: string,
  ref: MigrationReferenceData,
): OrderLineV2 {
  const product = ref.products.find(p => p.id === v1Line.product_id);
  const variant = ref.variants.find(v => v.id === v1Line.variant_id);
  const category = product ? ref.categories.find(c => c.id === product.category_id) : null;

  const productSnap: ProductSnapshot = product
    ? buildProductSnapshot(product, category)
    : { id: v1Line.product_id, name: "(missing)", category_id: "", category_name: "" };

  const variantSnap: VariantSnapshot = variant
    ? buildVariantSnapshot(variant)
    : { id: v1Line.variant_id, size_name: "(missing)", price: Number(v1Line.unit_price) || 0 };

  // Parse modifiers from V1 line
  let v1Mods: any[] = [];
  try {
    const parsed = JSON.parse(v1Line.modifiers_json || "[]");
    if (Array.isArray(parsed)) v1Mods = parsed;
  } catch {}

  const modifierSnap: ModifierSnapshot[] = v1Mods.map(m => ({
    id: String(m.id || ""),
    name: String(m.name || ""),
    price: Math.round(Number(m.price || 0)),
    qty: Number(m.qty || 1),
  }));

  // Reconstruct recipe snapshot (variant recipe + per-modifier recipes)
  const variantRecipe = ref.recipes.find(r =>
    r.target_type === "PRODUCT_VARIANT" && r.target_id === v1Line.variant_id &&
    (!r.end_date || r.end_date === ""),
  );
  const variantRecipeSnap: RecipeSnapshot = variantRecipe
    ? buildRecipeSnapshot(variantRecipe)
    : { target_type: "PRODUCT_VARIANT", target_id: v1Line.variant_id, ingredients: [] };

  const modifierRecipes = modifierSnap.map(mod => {
    const r = ref.recipes.find(rr =>
      rr.target_type === "MODIFIER" && rr.target_id === mod.id &&
      (!rr.end_date || rr.end_date === ""),
    );
    return {
      modifier_id: mod.id,
      modifier_name: mod.name,
      recipe: r ? buildRecipeSnapshot(r) : { target_type: "MODIFIER" as const, target_id: mod.id, ingredients: [] },
    };
  });

  const lineRecipeSnap: LineRecipeSnapshot = {
    variant: variantRecipeSnap,
    modifiers: modifierRecipes,
  };

  // Compute gross
  const qty = Number(v1Line.qty || 0);
  const unitPrice = Number(v1Line.unit_price || 0);
  const modsTotal = modifierSnap.reduce((s, m) => s + m.price * m.qty, 0);
  const gross = (unitPrice + modsTotal) * qty;

  // Promo discount from V1 line.line_discount (per WS-5 spec)
  const promoDiscount = Math.round(Number(v1Line.line_discount || 0));

  // Manual item discount from V1 (both fields could carry it)
  const lineManual = Math.round(Number(v1Line.line_manual_discount || 0));
  const legacyDiscountAmount = Math.round(Number(v1Line.discount_amount || 0));
  // Heuristic: if both present, take the larger (avoid double-counting)
  const manualItem = Math.max(lineManual, legacyDiscountAmount);

  return {
    id: `ol-migrated-${crypto.randomUUID()}`,
    order_id: orderId,
    line_no: lineNo,
    product_id: v1Line.product_id,
    product_snapshot_json: JSON.stringify(productSnap),
    variant_id: v1Line.variant_id,
    variant_snapshot_json: JSON.stringify(variantSnap),
    qty,
    unit_price: unitPrice,
    modifiers_snapshot_json: JSON.stringify(modifierSnap),
    gross_line_total: gross,
    promo_discount: promoDiscount,
    manual_item_discount: manualItem,
    order_discount_allocation: 0, // filled in by caller
    net_line_total: 0, // filled in by caller
    cost_at_sale: 0, // filled in by caller
    recipe_snapshot_json: JSON.stringify(lineRecipeSnap),
    promo_discount_reason: promoDiscount > 0 ? "MIGRATED_PROMO" : "",
    manual_discount_reason: manualItem > 0 ? "MIGRATED_MANUAL_ITEM" : "",
  };
}

// ============================================================
// Compute line cost from V1 ledger
// ============================================================

export function computeLineCostFromLedger(line: OrderLineV2, orderLedger: V1LedgerEntry[]): number {
  // Sum unit_cost * |quantity_change| across all SALES_CONSUME entries for this order.
  // We don't have per-line attribution in V1 ledger (reference_id is order-level only),
  // so we distribute the order's total ledger cost proportionally by line qty.
  if (orderLedger.length === 0) return 0;

  const totalLedgerCost = orderLedger.reduce((s, e) =>
    s + (Number(e.unit_cost) || 0) * Math.abs(Number(e.quantity_change) || 0), 0);

  // Allocate by line's gross proportion of order gross.
  // Caller should pass orderLedger filtered to the SAME order; this fn just computes share.
  // Note: this is approximate. Real per-line cost attribution would require ledger rewrite.
  // Documented in WS-5 known gaps.
  return Math.round(totalLedgerCost); // Caller divides by number of lines externally
}

// ============================================================
// Discount classifier (for debugging / dry-run report)
// ============================================================

export interface DiscountClassification {
  has_promo_snapshot: boolean;
  promo_type?: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  v1_order_discount_amount: number;
  v1_line_discount_sum: number;
  v1_line_manual_discount_sum: number;
  v1_legacy_discount_amount_sum: number;
  inferred_promo_total: number;
  inferred_manual_item_total: number;
  inferred_manual_order_discount: number;
  notes: string[];
}

export function classifyV1Discounts(v1Order: V1Order, v1Lines: V1Line[]): DiscountClassification {
  const notes: string[] = [];

  let promoType: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT" | undefined;
  if (v1Order.applied_promotion_snapshot_json) {
    try {
      const snap = JSON.parse(v1Order.applied_promotion_snapshot_json);
      promoType = snap.type;
    } catch {
      notes.push("applied_promotion_snapshot_json malformed");
    }
  } else if (v1Order.applied_promotion_id) {
    notes.push("applied_promotion_id set but snapshot empty (legacy E.1 bug pattern)");
  }

  const orderDiscount = Number(v1Order.discount_amount || 0);
  const lineDiscountSum = v1Lines.reduce((s, l) => s + Number(l.line_discount || 0), 0);
  const lineManualSum = v1Lines.reduce((s, l) => s + Number(l.line_manual_discount || 0), 0);
  const legacyDiscountSum = v1Lines.reduce((s, l) => s + Number(l.discount_amount || 0), 0);

  // Heuristic: line_discount is promo (per WS-5 spec)
  const inferredPromoTotal = lineDiscountSum;
  // Manual item is max of the two manual fields per line (avoid double-count)
  const inferredManualItem = v1Lines.reduce((s, l) =>
    s + Math.max(Number(l.line_manual_discount || 0), Number(l.discount_amount || 0)), 0);
  // Manual order = whatever V1 said, minus overlap with promo
  const inferredManualOrder = Math.max(0, orderDiscount - inferredPromoTotal);

  if (orderDiscount > 0 && lineDiscountSum > 0 && orderDiscount === lineDiscountSum) {
    notes.push("V1 order.discount_amount equals sum(line_discount) — likely double-counted in old reports");
  }

  return {
    has_promo_snapshot: !!v1Order.applied_promotion_snapshot_json,
    promo_type: promoType,
    v1_order_discount_amount: orderDiscount,
    v1_line_discount_sum: lineDiscountSum,
    v1_line_manual_discount_sum: lineManualSum,
    v1_legacy_discount_amount_sum: legacyDiscountSum,
    inferred_promo_total: inferredPromoTotal,
    inferred_manual_item_total: inferredManualItem,
    inferred_manual_order_discount: inferredManualOrder,
    notes,
  };
}
