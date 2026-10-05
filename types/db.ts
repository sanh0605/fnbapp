export interface DBOrder {
  id: string;
  order_no: string;
  total_amount: string;
  subtotal_amount: string;
  discount_amount: string;
  discount_type: string;
  status: string;
  method: string;
  staff_name: string;
  brand_id: string;
  outlet_id?: string;
  voided?: string | boolean;
  applied_promotion_id?: string;
  discount_reason?: string;
  applied_promotion_snapshot_json?: string;
  created_at: string;
}

export interface DBOrderLine {
  id: string;
  order_id: string;
  product_id: string;
  variant_id: string;
  qty: string;
  unit_price: string;
  line_discount: string;
  line_manual_discount?: string;
  discount_type: string;
  modifiers_json: string;
  created_at: string;
}

export interface DBPromotion {
  id: string;
  name: string;
  code: string;
  brand_id: string;
  type: "ORDER_DISCOUNT" | "PRODUCT_DISCOUNT";
  discount_type: "PERCENT" | "FLAT_PRICE" | "FLAT_VND";
  discount_value: string;
  min_order_value: string;
  start_date: string;
  end_date: string;
  applicable_products_json?: string;
  status: "ACTIVE" | "INACTIVE" | "DELETED";
  created_at: string;
}

export interface DBProduct {
  id: string;
  code: string;
  name: string;
  category_id: string;
  status: string;
}

export interface DBProductVariant {
  id: string;
  product_id: string;
  size_name: string;
  price: string;
  status: string;
}

export interface DBProductCategory {
  id: string;
  name: string;
  status: string;
}

export interface DBBrand {
  id: string;
  name: string;
  code: string;
  start_date: string;
  status: string;
  created_at: string;
}

export interface DBOutlet {
  id: string;
  code: string;
  name: string;
  brand_id: string;
  address: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  // "HH:MM" or "HH:MM:SS" (Postgres time's own serialization). Null on
  // both means no stated hours -- see lib/catalog/outlet-hours.ts.
  open_time: string | null;
  close_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface DBModifier {
  id: string;
  group_name: string;
  name: string;
  price: string;
  status: string;
  // BR-CATALOG-003 (migration 0097): links this modifier to the CAT-007
  // product it also sells standalone, if one exists. Nullable -- a
  // modifier may have no standalone counterpart (e.g. MOD-009).
  product_id: string | null;
}

export interface DBSupplier {
  id: string;
  name: string;
  phone: string;
  tax_id: string;
  address: string;
  links: string;
  status: string;
  created_at: string;
}

export interface DBUser {
  id: string;
  username: string;
  role: "STAFF" | "MANAGER" | "ADMIN";
  status: string;
  created_at: string;
}

export interface DBUnit {
  id: string;
  name: string;
  abbreviation: string;
  description?: string | null;
  status: string;
  created_at: string;
}

export interface DBItemCategory {
  id: string;
  name: string;
  system_type: "RAW" | "CONSUMABLE" | "EQUIPMENT";
  status: string;
  created_at: string;
}

export interface DBBaseIngredient {
  id: string;
  name: string;
  unit_id: string;
  is_non_inventory: string;
  status: string;
  created_at: string;
  base_unit?: string; // Joined field
}

export interface DBPurchasedItem {
  id: string;
  name: string;
  item_category_id: string;
  default_unit_id: string;
  status: string;
  created_at: string;
  // 2026-08-21: same concept as base_ingredients.is_non_inventory, needed
  // here because a CONSUMABLE item has no base_ingredient_id to carry the
  // flag on (non-inventory purchased items, 2026-08-21).
  is_non_inventory: boolean;
}

// Batch 3 (asset register, 2026-08-22).
export interface DBAssetDepreciationBand {
  id: string;
  min_unit_price: number;
  max_unit_price: number | null;
  term_months: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DBAsset {
  id: string;
  purchased_item_id: string;
  purchase_order_line_id: string | null;
  name_snapshot: string;
  acquired_date: string;
  unit_cost: number;
  // 2026-08-23 fix: the allocated line total, unrounded by division --
  // depreciation is computed from this, not quantity * unit_cost.
  total_cost: number;
  quantity: number;
  term_months: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DBAssetDisposal {
  id: string;
  asset_id: string;
  quantity: number;
  disposed_date: string;
  reason: string;
  created_by_id: string;
  created_by_name: string;
  created_at: string;
}

export interface DBUOMConversion {
  id: string;
  purchased_item_id: string;
  from_unit_id: string;
  to_unit_id: string;
  factor: string;
  status: string;
  created_at: string;
  purchased_unit?: string; // Joined field
  base_unit?: string; // Joined field
  conversion_rate?: string; // Joined field
  // Plan D D15: true for a purchase-only bundle (e.g. a combo of several
  // bags) -- offered when receiving a purchase order, hidden from
  // stocktake and issue-slip lines (lib/stock/stocktake-package-lines.ts).
  purchase_only: boolean;
}

export interface DBPurchaseSource {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

export interface DBPurchaseOrder {
  id: string;
  supplier_id: string;
  source_id: string;
  transaction_date: string;
  subtotal: string;
  shipping_cost: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  status: string;
  created_at: string;
  supplier_invoice_code?: string;
  notes?: string;
  shipping_fee?: string;
  voucher_amount?: string;
  // Added by migration 0107. Nullable: a draft may not have chosen yet.
  payment_method?: "CASH" | "BANK_TRANSFER" | null;
  bank_account_id?: string | null;
  // Added by migration 0108 (BR-INV-015); all null unless status is CANCELLED.
  cancelled_at?: string | null;
  cancelled_by_id?: string | null;
  cancelled_by_name?: string | null;
  cancel_reason?: string | null;
}

export interface DBPurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  item_id: string;
  quantity: string;
  unit_id: string;
  unit_cost: string;
  subtotal: string;
  created_at: string;
}

export interface DBPriceHistory {
  id: string;
  variant_id: string;
  old_price: string | null;
  new_price: string;
  effective_at: string;
  created_at: string;
}

export interface DBCashCategory {
  id: string;
  name: string;
  kind: "EXPENSE" | "INCOME";
  affects_pnl: boolean;
  // BR-CASH-006: only an income category that counts in profit and loss may be true.
  is_sales_revenue: boolean;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  created_by_id: string | null;
  created_by_name: string | null;
  updated_at: string;
  updated_by_id: string | null;
  updated_by_name: string | null;
}

export interface DBBankAccount {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  created_by_id: string | null;
  created_by_name: string | null;
  updated_at: string;
  updated_by_id: string | null;
  updated_by_name: string | null;
}

export interface DBCashEntry {
  id: string;
  // "YYYY-MM-DD" -- Postgres date: no time, no zone.
  entry_date: string;
  category_id: string;
  // VND has no minor unit; this is a whole number of dong.
  amount: number;
  payment_method: "CASH" | "BANK_TRANSFER";
  bank_account_id: string | null;
  payer: string | null;
  note: string | null;
  status: "ACTIVE" | "CANCELLED";
  created_at: string;
  created_by_id: string | null;
  created_by_name: string | null;
  updated_at: string;
  updated_by_id: string | null;
  updated_by_name: string | null;
}

export interface DBCashTransfer {
  id: string;
  // "YYYY-MM-DD" -- Postgres date: no time, no zone.
  transfer_date: string;
  // Whole dong, always > 0.
  amount: number;
  // null = the cash drawer
  from_account_id: string | null;
  to_account_id: string | null;
  note: string;
  status: "ACTIVE" | "CANCELLED";
  created_at: string;
  created_by_id: string | null;
  created_by_name: string | null;
  updated_at: string;
  updated_by_id: string | null;
  updated_by_name: string | null;
}

// One row of the read-only view public.cash_book_daily (migration 0107):
// sales or purchase money of one Saigon day and one payment method.
export interface DBCashBookDailyRow {
  source: "SALE" | "PURCHASE";
  // "YYYY-MM-DD", Asia/Saigon calendar day
  day: string;
  method: "CASH" | "BANK_TRANSFER";
  bank_account_id: string | null;
  doc_count: number;
  amount: number;
}
