# System map (generated)

Do not edit by hand. Regenerate with `vite-node scripts/system-map/generate.ts`.

## Write relations
```relations
app/actions/auth.ts -> users (write)
app/admin/brands/actions.ts -> Brands (write)
app/admin/dashboard-settings/actions.ts -> Dashboard_Settings (write)
app/admin/finance/actions.ts -> Cash_Entries (write)
app/admin/finance/bank-accounts/actions.ts -> Bank_Accounts (write)
app/admin/finance/categories/actions.ts -> Cash_Categories (write)
app/admin/finance/monthly-items/actions.ts -> Monthly_Expense_Items (write)
app/admin/finance/transfers/actions.ts -> Cash_Transfers (write)
app/admin/inventory/actions.ts -> Item_Categories (write)
app/admin/inventory/actions.ts -> Units (write)
app/admin/inventory/assets/actions.ts -> asset_disposals (write)
app/admin/inventory/conversions/actions.ts -> UOM_Conversions (write)
app/admin/inventory/items/actions.ts -> assets (write)
app/admin/inventory/items/actions.ts -> Purchased_Items (write)
app/admin/inventory/items/actions.ts -> UOM_Conversions (write)
app/admin/inventory/purchase-orders/actions.ts -> purchase_order_edits (write)
app/admin/inventory/purchase-orders/actions.ts -> Purchase_Sources (write)
app/admin/outlets/actions.ts -> Outlets (write)
app/admin/pos-sync/actions.ts -> Pos_Sync_Failures (write)
app/admin/products/actions.ts -> Products (write)
app/admin/products/categories/actions.ts -> Product_Categories (write)
app/admin/products/modifier-groups/actions.ts -> Modifier_Groups (write)
app/admin/products/modifiers/actions.ts -> Modifiers (write)
app/admin/products/types/actions.ts -> Product_Types (write)
app/admin/promotions/actions.ts -> Promotions (write)
app/admin/suppliers/actions.ts -> Suppliers (write)
app/admin/users/actions.ts -> Users (write)
app/pos/actions.ts -> POS_Drafts (write)
app/pos/actions.ts -> Pos_Sync_Failures (write)
lib/assets/asset-bands-transaction.ts -> asset_depreciation_bands (write)
lib/products/create-standalone-topping.ts -> modifiers (write)
lib/products/create-standalone-topping.ts -> product_price_history (write)
lib/products/create-standalone-topping.ts -> product_variants (write)
lib/products/create-standalone-topping.ts -> products (write)
lib/products/modifier-group-transaction.ts -> modifier_group_products (write)
lib/products/modifier-group-transaction.ts -> modifier_groups (write)
lib/products/modifier-group-transaction.ts -> modifiers (write)
lib/products/modifier-save-transaction.ts -> modifiers (write)
lib/products/product-erase-transaction.ts -> product_price_history (write)
lib/products/product-erase-transaction.ts -> product_variants (write)
lib/products/product-erase-transaction.ts -> products (write)
lib/products/product-save-transaction.ts -> modifier_group_products (write)
lib/products/product-save-transaction.ts -> product_price_history (write)
lib/products/product-save-transaction.ts -> product_variants (write)
lib/products/product-save-transaction.ts -> products (write)
lib/products/product-status-transaction.ts -> product_variants (write)
lib/products/product-status-transaction.ts -> products (write)
lib/purchasing/purchase-order-cancel-transaction.ts -> assets (write)
lib/purchasing/purchase-order-cancel-transaction.ts -> purchase_orders (write)
lib/purchasing/purchase-order-transaction.ts -> assets (write)
lib/purchasing/purchase-order-transaction.ts -> purchase_order_lines (write)
lib/purchasing/purchase-order-transaction.ts -> purchase_orders (write)
lib/sales/void-order-transaction.ts -> order_events (write)
lib/sales/void-order-transaction.ts -> orders_v2 (write)
lib/stock/manual-issue-transaction.ts -> issue_slips (write)
lib/stock/manual-issue-transaction.ts -> stock_issues (write)
lib/stock/stocktake-transaction.ts -> stock_issues (write)
lib/stock/stocktake-transaction.ts -> stocktake_lines (write)
lib/stock/stocktake-transaction.ts -> stocktake_sessions (write)
```

## Tables
- asset_depreciation_bands (id, min_unit_price, max_unit_price, term_months, status, created_at, updated_at)
- asset_disposals (id, asset_id, quantity, disposed_date, reason, created_by_id, created_by_name, created_at)
- assets (id, purchased_item_id, purchase_order_line_id, name_snapshot, acquired_date, unit_cost, quantity, term_months, status, created_at, updated_at, total_cost)
- bank_accounts (id, name, bank_name, account_number, status, created_at, created_by_id, created_by_name, updated_at, updated_by_id, updated_by_name) status: ACTIVE, INACTIVE
- brands (id, name, code, start_date, status, created_at, updated_at) status: ACTIVE, INACTIVE, DELETED
- cash_categories (id, name, kind, affects_pnl, status, created_at, created_by_id, created_by_name, updated_at, updated_by_id, updated_by_name, is_sales_revenue) status: ACTIVE, INACTIVE
- cash_entries (id, entry_date, category_id, amount, payment_method, bank_account_id, payer, note, status, created_at, created_by_id, created_by_name, updated_at, updated_by_id, updated_by_name, or, monthly_item_id) status: ACTIVE, CANCELLED
- cash_transfers (id, transfer_date, amount, from_account_id, to_account_id, note, status, created_at, created_by_id, created_by_name, updated_at, updated_by_id, updated_by_name) status: ACTIVE, CANCELLED
- dashboard_settings (id, stale_stocktake_days, open_stocktake_days, reminder_start_day, food_product_ids, topping_type_id, updated_at, updated_by_id, updated_by_name)
- issue_slips (id, issued_at, note, created_by_id, created_by_name, created_at)
- item_categories (id, name, system_type, status, created_at) status: ACTIVE, INACTIVE, DELETED
- modifier_group_products (id, group_id, product_id)
- modifier_groups (id, name, selection_mode, max_total, allow_standalone, sort_order, status, created_at, updated_at) status: ACTIVE, INACTIVE
- modifiers (id, name, price, status, sort_order, created_at, updated_at, product_id, group_id, is_default, max_qty) status: ACTIVE, INACTIVE, DELETED
- monthly_expense_items (id, name, cash_category_id, status, created_at, created_by_id, created_by_name, updated_at, updated_by_id, updated_by_name) status: ACTIVE, INACTIVE
- order_events (id, order_id, event_type, event_at, actor_id, actor_name, from_version, to_version, previous_order_id, delta_json, reason)
- order_lines_v2 (id, order_id, line_no, product_id, product_snapshot_json, variant_id, variant_snapshot_json, qty, unit_price, modifiers_snapshot_json, gross_line_total, promo_discount, manual_item_discount, order_discount_allocation, net_line_total, cost_at_sale, recipe_snapshot_json, promo_discount_reason, manual_discount_reason, created_at)
- order_payments (id, order_id, method, amount, reference, created_at)
- orders_v2 (id, order_no, brand_id, status, version, parent_order_id, superseded_by, created_at, created_by_id, created_by_name, completed_at, voided_at, voided_by_id, void_reason, currency, gross_total, promo_discount_total, manual_item_discount_total, manual_order_discount, net_total, applied_promotion_id, applied_promotion_snapshot_json, pos_snapshot_json, payment_method, payment_ref, migration_notes, updated_at, client_request_id, synced_at, outlet_id, legacy_order_no) status: DRAFT, COMPLETED, SUPERSEDED, VOIDED
- outlets (id, code, name, brand_id, address, status, start_date, end_date, created_at, updated_at, open_time, close_time)
- pos_drafts (id, cart_json, status, created_at, updated_at, timestamp, name, brand_id, created_by_id, created_by_name, outlet_id) status: OPEN, SUBMITTED, ABANDONED
- pos_sync_failures (id, request_token, cart_payload_json, error_message, occurred_at, resolved)
- product_categories (id, name, status, created_at, type_id) status: ACTIVE, INACTIVE, DELETED
- product_price_history (id, variant_id, old_price, new_price, reason, effective_at, created_at)
- product_types (id, name, is_drink, created_at)
- product_variants (id, product_id, size_name, price, sort_order, status, created_at, updated_at) status: ACTIVE, INACTIVE, DELETED
- products (id, name, category_id, brand_id, description, status, image_url, sort_order, created_at, updated_at, duplicate_warning_confirmed, duplicate_warning_confirmed_by, duplicate_warning_confirmed_at) status: ACTIVE, INACTIVE, DELETED
- promotions (id, name, brand_id, code, type, discount_type, discount_value, applicable_products_json, start_date, end_date, status, created_at, updated_at, min_order_value) status: ACTIVE, INACTIVE, DELETED
- purchase_order_edits (id, purchase_order_id, edited_by_id, edited_by_name, edited_at, previous_status, previous_subtotal_amount, previous_line_count, new_subtotal_amount, new_line_count)
- purchase_order_lines (id, purchase_order_id, purchased_item_id, unit, quantity, unit_price, subtotal, conversion_id, base_unit, base_quantity, created_at)
- purchase_orders (id, supplier_id, source_id, transaction_date, supplier_invoice_code, notes, subtotal_amount, shipping_fee, tax_amount, voucher_amount, discount_amount, total_amount, status, created_by_id, created_by_name, created_at, updated_at, payment_method, bank_account_id, cancelled_at, cancelled_by_id, cancelled_by_name, cancel_reason) status: DRAFT, COMPLETED, CANCELLED
- purchase_sources (id, name, status, created_at) status: ACTIVE, INACTIVE, DELETED
- purchased_items (id, name, item_category_id, default_unit_id, status, created_at, updated_at, duplicate_warning_confirmed, duplicate_warning_confirmed_by, duplicate_warning_confirmed_at, is_non_inventory) status: ACTIVE, INACTIVE, DELETED
- stock_issues (id, purchased_item_id, issued_at, base_quantity, source, session_id, note, created_at, reverses_issue_id, issue_slip_id)
- stocktake_lines (id, session_id, item_reference, item_type, counted_qty, theoretical_at_count, counted_at, and)
- stocktake_sessions (id, status, created_by_id, created_by_name, created_at, confirmed_by_id, confirmed_by_name, confirmed_at, notes, updated_at, reversed_by_id, reversed_by_name, reversed_at, reversed_reason, is_shrinkage) status: OPEN, CONFIRMED, CANCELLED
- suppliers (id, name, tax_id, address, links, status, created_at, phone, parent_id, duplicate_warning_confirmed, duplicate_warning_confirmed_by, duplicate_warning_confirmed_at) status: ACTIVE, INACTIVE, DELETED
- units (id, name, abbreviation, status, created_at, description) status: ACTIVE, INACTIVE, DELETED
- uom_conversions (id, purchased_item_id, base_unit, purchased_unit, conversion_rate, status, created_at, updated_at, purchase_only) status: ACTIVE, INACTIVE, DELETED
- users (id, username, password_hash, name, role, status, created_at, updated_at) status: ACTIVE, INACTIVE, DELETED

## UNRESOLVED write-sites (need a human)
- app/admin/inventory/items/actions.ts: remove(...) with a non-literal table argument: 
- app/admin/inventory/purchase-orders/actions.ts: insert(...) with a non-literal table argument: 
- app/admin/inventory/purchase-orders/actions.ts: update(...) with a non-literal table argument: 
- app/admin/users/actions.ts: update(...) with a non-literal table argument: only if non-blank
