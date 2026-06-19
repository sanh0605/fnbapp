/**
 * Orders V2 — strict data models.
 *
 * Spec: docs/superpowers/specs/2026-06-18-orders-reports-rebuild.md (section 5)
 *
 * All money fields are integer đồng (VND). No floats.
 * All IDs are UUIDs (crypto.randomUUID()). No time-based IDs.
 * All timestamps are ISO 8601 UTC strings.
 */

// ============================================================================
// Enums (as const objects for nominal typing + runtime values)
// ============================================================================

export const ORDER_STATUS = {
  DRAFT: "DRAFT",
  COMPLETED: "COMPLETED",
  SUPERSEDED: "SUPERSEDED",
  VOIDED: "VOIDED",
} as const;
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const EVENT_TYPE = {
  CREATED: "CREATED",
  EDITED: "EDITED",
  VOIDED: "VOIDED",
  REOPENED: "REOPENED",
  MIGRATED: "MIGRATED",
} as const;
export type EventType = (typeof EVENT_TYPE)[keyof typeof EVENT_TYPE];

export const PAYMENT_METHOD = {
  CASH: "CASH",
  BANK_TRANSFER: "BANK_TRANSFER",
} as const;
export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const STOCK_TXN_TYPE = {
  SALES_CONSUME: "SALES_CONSUME",
  EDIT_REVERSAL: "EDIT_REVERSAL",
  EDIT_CONSUME: "EDIT_CONSUME",
  PO_RECEIPT: "PO_RECEIPT",
  ADJUSTMENT_IN: "ADJUSTMENT_IN",
  ADJUSTMENT_OUT: "ADJUSTMENT_OUT",
} as const;
export type StockTxnType = (typeof STOCK_TXN_TYPE)[keyof typeof STOCK_TXN_TYPE];

// ============================================================================
// Snapshot sub-types (stored as JSON strings in sheets, parsed for use)
// ============================================================================

export interface ProductSnapshot {
  id: string;
  name: string;
  category_id: string;
  category_name: string;
}

export interface VariantSnapshot {
  id: string;
  size_name: string;
  price: number; // integer đồng
}

export interface ModifierSnapshot {
  id: string;
  name: string;
  price: number; // integer đồng
  qty: number; // ≥ 1
}

export interface PromotionSnapshot {
  id: string;
  name: string;
  type: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  discount_type: "PERCENT" | "FLAT_PRICE" | "FLAT_VND";
  discount_value: number;
  applicable_products_json?: string;
  code?: string;
  start_date: string;
  end_date: string;
}

export interface RecipeIngredientSnapshot {
  ingredient_id: string;
  ingredient_type: "BASE_INGREDIENT" | "SEMI_PRODUCT";
  quantity: number;
  unit_id: string;
}

export interface RecipeSnapshot {
  target_type: "PRODUCT_VARIANT" | "MODIFIER";
  target_id: string;
  ingredients: RecipeIngredientSnapshot[];
}

// ============================================================================
// Core row types — match Orders_V2, Order_Lines_V2, Order_Events sheet columns
// ============================================================================

export interface OrderV2 {
  // Identity
  id: string;
  order_no: string;
  brand_id: string;

  // Lifecycle
  status: OrderStatus;
  version: number;
  parent_order_id: string | "";
  superseded_by: string | "";

  // Audit
  created_at: string;
  created_by_id: string;
  created_by_name: string;
  completed_at: string | "";
  voided_at: string | "";
  voided_by_id: string | "";
  void_reason: string | "";

  // Money (integer đồng; all immutable once status = COMPLETED)
  currency: "VND";
  gross_total: number;
  promo_discount_total: number;
  manual_item_discount_total: number;
  manual_order_discount: number;
  net_total: number;

  // Snapshots & payment
  applied_promotion_id: string | "";
  applied_promotion_snapshot_json: string; // empty string when no promo
  pos_snapshot_json: string;
  payment_method: PaymentMethod;
  payment_ref: string | "";

  // Migration metadata
  migration_notes: string | "";
}

export interface OrderLineV2 {
  // Identity
  id: string;
  order_id: string;
  line_no: number;

  // Product references + snapshots
  product_id: string;
  product_snapshot_json: string; // JSON of ProductSnapshot
  variant_id: string;
  variant_snapshot_json: string; // JSON of VariantSnapshot

  // Quantities
  qty: number; // ≥ 1
  unit_price: number; // integer đồng, snapshotted
  modifiers_snapshot_json: string; // JSON of ModifierSnapshot[]

  // Money (integer đồng)
  gross_line_total: number;
  promo_discount: number;
  manual_item_discount: number;
  order_discount_allocation: number;
  net_line_total: number;

  // Cost & stock
  cost_at_sale: number;
  recipe_snapshot_json: string; // JSON of RecipeSnapshot

  // Attribution
  promo_discount_reason: string | "";
  manual_discount_reason: string | "";
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: EventType;
  event_at: string;
  actor_id: string;
  actor_name: string;
  from_version: number | "";
  to_version: number;
  previous_order_id: string | "";
  delta_json: string; // JSON summary of changes
  reason: string;
}

// ============================================================================
// Input shapes (used by pure functions — sheets-agnostic)
// ============================================================================

/**
 * Shape passed to `allocateLineRevenue`. Callers parse the JSON snapshots
 * before calling. The function is pure data-in, data-out.
 */
export interface LineForAllocation {
  unit_price: number;
  qty: number;
  modifiers: ModifierSnapshot[];
  gross_line_total: number;
  promo_discount: number;
  manual_item_discount: number;
  order_discount_allocation: number;
}

export interface AllocatedRevenue {
  variantRevenue: number;
  modifierRevenue: Record<string, number>;
  lineRevenue: number;
}

export interface AllocatableLine {
  line_id: string;
  capacity: number; // gross_line_total - promo_discount - manual_item_discount
}

// ============================================================================
// Errors
// ============================================================================

export class InvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantError";
  }
}

// ============================================================================
// Line recipe snapshot — combined variant + modifier recipes
// ============================================================================

export interface ModifierRecipeEntry {
  modifier_id: string;
  modifier_name: string;
  recipe: RecipeSnapshot;
}

export interface LineRecipeSnapshot {
  variant: RecipeSnapshot;
  modifiers: ModifierRecipeEntry[];
}

/** Parse the combined recipe_snapshot_json. Throws InvariantError on malformed JSON. */
export function parseLineRecipeSnapshot(json: string): LineRecipeSnapshot {
  if (!json || json === "{}" || json === "") {
    return {
      variant: { target_type: "PRODUCT_VARIANT", target_id: "", ingredients: [] },
      modifiers: [],
    };
  }
  try {
    const parsed = JSON.parse(json);
    // New shape
    if (parsed && typeof parsed === "object" && "variant" in parsed) {
      return parsed as LineRecipeSnapshot;
    }
    // Legacy shape (raw RecipeSnapshot) — wrap as variant-only
    if (parsed && typeof parsed === "object" && "target_type" in parsed) {
      return { variant: parsed as RecipeSnapshot, modifiers: [] };
    }
  } catch {}
  return {
    variant: { target_type: "PRODUCT_VARIANT", target_id: "", ingredients: [] },
    modifiers: [],
  };
}
