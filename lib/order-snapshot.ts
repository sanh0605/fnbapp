/**
 * Pure functions that build snapshots from raw DB rows.
 *
 * Snapshots freeze the state of reference data at the moment of order
 * confirmation, so historical orders are immune to later edits of
 * products, variants, modifiers, promotions, and recipes.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 5)
 */

import type {
  ProductSnapshot,
  VariantSnapshot,
  ModifierSnapshot,
  PromotionSnapshot,
  RecipeSnapshot,
  RecipeIngredientSnapshot,
} from "@/lib/order-types";

export function buildProductSnapshot(product: any, category: any | null): ProductSnapshot {
  return {
    id: String(product.id || ""),
    name: String(product.name || ""),
    category_id: String(product.category_id || ""),
    category_name: category ? String(category.name || "") : "",
  };
}

export function buildVariantSnapshot(variant: any): VariantSnapshot {
  const price = Number(variant.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Variant ${variant.id} has invalid price: ${variant.price}`);
  }
  return {
    id: String(variant.id || ""),
    size_name: String(variant.size_name || ""),
    price: Math.round(price),
  };
}

export function buildModifierSnapshots(modifiers: any[]): ModifierSnapshot[] {
  const seen = new Map<string, ModifierSnapshot>();
  for (const m of modifiers) {
    const id = String(m.id || "");
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.set(id, {
      id,
      name: String(m.name || ""),
      price: Math.round(Number(m.price || 0)),
      qty: 1,
    });
  }
  return Array.from(seen.values());
}

/**
 * Build modifier snapshots from a cart selection (which may include the
 * same modifier multiple times → qty > 1).
 */
export function buildModifierSnapshotsFromCart(
  cartSelection: Array<{
    modifier_id: string;
    modifier_qty: number;
    modifier_name_snapshot?: string;
    modifier_price_snapshot?: number;
  }>,
  modifierRows: any[],
): ModifierSnapshot[] {
  const qtyById = new Map<string, number>();
  const snapshotById = new Map<string, { name?: string; price?: number }>();
  for (const sel of cartSelection) {
    const id = String(sel.modifier_id || "");
    const qty = Number(sel.modifier_qty || 1);
    qtyById.set(id, (qtyById.get(id) || 0) + qty);
    if (!snapshotById.has(id)) {
      snapshotById.set(id, {
        name: sel.modifier_name_snapshot,
        price: Number.isFinite(Number(sel.modifier_price_snapshot)) ? Number(sel.modifier_price_snapshot) : undefined,
      });
    }
  }

  const result: ModifierSnapshot[] = [];
  for (const [id, qty] of qtyById.entries()) {
    const row = modifierRows.find((m: any) => m.id === id);
    const snapshot = snapshotById.get(id);
    if (!row && !snapshot?.name) continue;
    result.push({
      id,
      name: String(snapshot?.name || row?.name || ""),
      price: Math.round(Number(snapshot?.price ?? row?.price ?? 0)),
      qty,
    });
  }
  return result;
}

export function buildPromotionSnapshot(promo: any): PromotionSnapshot {
  return {
    id: String(promo.id || ""),
    name: String(promo.name || ""),
    type: promo.type === "ORDER_DISCOUNT" ? "ORDER_DISCOUNT" : "PRODUCT_DISCOUNT",
    discount_type: promo.discount_type === "PERCENT" ? "PERCENT"
      : promo.discount_type === "FLAT_PRICE" ? "FLAT_PRICE"
      : "FLAT_VND",
    discount_value: Number(promo.discount_value || 0),
    applicable_products_json: promo.applicable_products_json || "",
    code: promo.code || "",
    start_date: String(promo.start_date || ""),
    end_date: String(promo.end_date || ""),
  };
}

export function buildRecipeSnapshot(recipe: any): RecipeSnapshot {
  let ingredients: RecipeIngredientSnapshot[] = [];
  try {
    const parsed = JSON.parse(recipe.ingredients_json || "[]");
    if (Array.isArray(parsed)) {
      ingredients = parsed.map((ing: any) => ({
        ingredient_id: String(ing.ingredient_id || ""),
        ingredient_type: ing.ingredient_type === "SEMI_PRODUCT" ? "SEMI_PRODUCT" : "BASE_INGREDIENT",
        quantity: Number(ing.quantity || 0),
        unit_id: String(ing.unit_id || ""),
      }));
    }
  } catch {
    ingredients = [];
  }
  return {
    target_type: recipe.target_type === "MODIFIER" ? "MODIFIER" : "PRODUCT_VARIANT",
    target_id: String(recipe.target_id || ""),
    ingredients,
  };
}
