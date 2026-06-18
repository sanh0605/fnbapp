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
  buildRecipeSnapshot,
} from "@/lib/order-snapshot";
import { allocateOrderDiscount, assertOrderInvariants } from "@/lib/order-math";
import { InvariantError, ORDER_STATUS, PAYMENT_METHOD } from "@/lib/order-types";
import type {
  OrderV2,
  OrderLineV2,
  PromotionSnapshot,
  RecipeSnapshot,
  ProductSnapshot,
  VariantSnapshot,
  ModifierSnapshot,
} from "@/lib/order-types";

export interface CartItemInput {
  product_id: string;
  variant_id: string;
  qty: number;
  modifiers: Array<{ modifier_id: string; modifier_qty: number }>;
  manual_item_discount: { value: number; type: "VND" | "PERCENT" };
}

export interface CartInput {
  brand_id: string;
  items: CartItemInput[];
  payment_method: "CASH" | "BANK_TRANSFER";
  manual_order_discount?: { value: number; type: "VND" | "PERCENT" } | null;
  applied_promotion_id?: string | null; // explicit override; else auto-resolve
  actor: { id: string; name: string };
}

export interface ReferenceData {
  brands: any[];
  products: any[];
  variants: any[];
  categories: any[];
  modifiers: any[];
  promotions: any[];
  recipes: any[];
  base_ingredients: any[];
}

interface BuiltLine {
  spec: OrderLineV2;
  capacity: number; // gross - promo - manual_item
}

export interface BuildOrderResult {
  order: OrderV2;
  lines: OrderLineV2[];
  resolvedPromotion: PromotionSnapshot | null;
  resolvedRecipes: RecipeSnapshot[]; // per line, same order as lines
}

export function buildOrderFromCart(input: CartInput, ref: ReferenceData): BuildOrderResult {
  if (!input.items || input.items.length === 0) {
    throw new InvariantError("Cart is empty");
  }

  const brand = ref.brands.find(b => b.id === input.brand_id);
  if (!brand) throw new InvariantError(`Unknown brand: ${input.brand_id}`);

  const createdAt = new Date().toISOString();
  const orderId = `ord-${crypto.randomUUID()}`;

  // Resolve promotion (auto or explicit)
  const resolvedPromo = resolvePromotion(input, ref);
  const promoSnapshot = resolvedPromo ? buildPromotionSnapshot(resolvedPromo) : null;

  // Build line specs WITHOUT order_discount_allocation (computed below)
  const builtLines: BuiltLine[] = [];
  for (let i = 0; i < input.items.length; i++) {
    const item = input.items[i];
    const line = buildLine(item, ref, orderId, i + 1, createdAt, resolvedPromo);
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

  const order: OrderV2 = {
    id: orderId,
    order_no: "", // assigned by server action after row reservation
    brand_id: input.brand_id,
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
    payment_method: input.payment_method === "BANK_TRANSFER" ? PAYMENT_METHOD.BANK_TRANSFER : PAYMENT_METHOD.CASH,
    payment_ref: "",
    migration_notes: "",
  };

  // Guardian: assert all 7 invariants before returning
  assertOrderInvariants(order, builtLines.map(l => l.spec));

  return {
    order,
    lines: builtLines.map(l => l.spec),
    resolvedPromotion: promoSnapshot,
    resolvedRecipes: builtLines.map(l => JSON.parse(l.spec.recipe_snapshot_json) as RecipeSnapshot),
  };
}

// ============================================================
// Internal helpers
// ============================================================

function resolvePromotion(input: CartInput, ref: ReferenceData): any | null {
  const now = new Date();
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

function sumModifierPrices(mods: Array<{ modifier_id: string; modifier_qty: number }>, ref: ReferenceData): number {
  let sum = 0;
  for (const m of mods) {
    const row = ref.modifiers.find((r: any) => r.id === m.modifier_id);
    if (row) sum += Number(row.price) * Number(m.modifier_qty || 1);
  }
  return sum;
}

function buildLine(
  item: CartItemInput,
  ref: ReferenceData,
  orderId: string,
  lineNo: number,
  createdAt: string,
  resolvedPromo: any | null,
): BuiltLine {
  const product = ref.products.find(p => p.id === item.product_id);
  if (!product) throw new InvariantError(`Unknown product: ${item.product_id}`);

  const variant = ref.variants.find(v => v.id === item.variant_id);
  if (!variant) throw new InvariantError(`Unknown variant: ${item.variant_id}`);

  const category = ref.categories.find(c => c.id === product.category_id) || null;

  const productSnap = buildProductSnapshot(product, category);
  const variantSnap = buildVariantSnapshot(variant);
  const modifierSnap = buildModifierSnapshotsFromCart(item.modifiers, ref.modifiers);

  // Recipe at sale time (most recent non-expired)
  const recipe = pickRecipe(ref.recipes, "PRODUCT_VARIANT", item.variant_id);
  const recipeSnap = recipe ? buildRecipeSnapshot(recipe) : {
    target_type: "PRODUCT_VARIANT" as const,
    target_id: item.variant_id,
    ingredients: [],
  };

  // Gross
  const gross = (variantSnap.price + modifierSnap.reduce((s, m) => s + m.price * m.qty, 0)) * item.qty;

  // Promo
  const promoDiscount = computePromoForLine(resolvedPromo, item, variantSnap, modifierSnap, gross);

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
    recipe_snapshot_json: JSON.stringify(recipeSnap),
    promo_discount_reason: promoDiscount > 0 && resolvedPromo ? resolvedPromo.id : "",
    manual_discount_reason: manualItem > 0 ? "MANUAL_CASHIER" : "",
  };

  return { spec, capacity: Math.max(0, gross - promoDiscount - manualItem) };
}

function pickRecipe(recipes: any[], targetType: string, targetId: string): any | null {
  const now = new Date();
  const candidates = recipes.filter(r =>
    r.target_type === targetType &&
    r.target_id === targetId &&
    (!r.end_date || r.end_date === "" || new Date(r.end_date) >= now),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
  );
  return candidates[0];
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
