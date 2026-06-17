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
  discount_type: "PERCENT" | "FLAT_PRICE";
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

export interface DBModifier {
  id: string;
  group_name: string;
  name: string;
  price: string;
  status: string;
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
  password: string;
  role: "STAFF" | "MANAGER" | "ADMIN";
  status: string;
  created_at: string;
}

export interface DBUnit {
  id: string;
  name: string;
  abbreviation: string;
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
  base_ingredient_id: string;
  default_unit_id: string;
  status: string;
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
}

export interface DBRecipe {
  id: string;
  target_type: "PRODUCT_VARIANT" | "SEMI_PRODUCT" | "MODIFIER";
  target_id: string;
  ingredients_json: string;
  status: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface DBStockLedger {
  id: string;
  item_type: string;
  item_id: string;
  transaction_type: string;
  quantity: string;
  unit_cost: string;
  reference_id: string;
  notes: string;
  created_at: string;
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

export interface DBSemiProduct {
  id: string;
  name: string;
  unit_id: string;
  status: string;
  created_at: string;
  base_unit?: string; // Joined field
  batch_yield?: string; // Joined field
}

export interface DBProductionOrder {
  id: string;
  semi_product_id: string;
  target_yield: string;
  status: string;
  created_at: string;
}

export interface DBProductionItem {
  id: string;
  production_order_id: string;
  ingredient_type: string;
  ingredient_id: string;
  quantity: string;
  unit_id: string;
  created_at: string;
  semi_product_id?: string; // Joined field
  qty_produced?: string; // Joined field
}

export interface DBPriceHistory {
  id: string;
  variant_id: string;
  price: string;
  effective_date: string;
  created_at: string;
}
