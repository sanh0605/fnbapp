# System map (generated)

Do not edit by hand. Regenerate with `vite-node scripts/system-map/generate.ts`.

## Write relations
```relations
app/actions/auth.ts -> users (write)
app/admin/brands/actions.ts -> Brands (write)
app/admin/inventory/actions.ts -> Item_Categories (write)
app/admin/inventory/actions.ts -> Purchase_Order_Lines (write)
app/admin/inventory/actions.ts -> Purchased_Items (write)
app/admin/inventory/actions.ts -> Stock_Adjustments (write)
app/admin/inventory/actions.ts -> Units (write)
app/admin/inventory/actions.ts -> UOM_Conversions (write)
app/admin/inventory/asset-bands/actions.ts -> asset_depreciation_bands (write)
app/admin/inventory/assets/actions.ts -> asset_disposals (write)
app/admin/inventory/conversions/actions.ts -> Purchase_Order_Lines (write)
app/admin/inventory/conversions/actions.ts -> UOM_Conversions (write)
app/admin/inventory/items/actions.ts -> Purchase_Order_Lines (write)
app/admin/inventory/items/actions.ts -> Purchased_Items (write)
app/admin/inventory/items/actions.ts -> UOM_Conversions (write)
app/admin/inventory/purchase-orders/actions.ts -> assets (write)
app/admin/inventory/purchase-orders/actions.ts -> purchase_order_edits (write)
app/admin/inventory/purchase-orders/actions.ts -> Purchase_Sources (write)
app/admin/outlets/actions.ts -> Outlets (write)
app/admin/pos-sync/actions.ts -> Pos_Sync_Failures (write)
app/admin/products/actions.ts -> Product_Variants (write)
app/admin/products/actions.ts -> Products (write)
app/admin/products/categories/actions.ts -> Product_Categories (write)
app/admin/products/modifiers/actions.ts -> Modifiers (write)
app/admin/products/toppings/actions.ts -> Products (write)
app/admin/promotions/actions.ts -> Promotions (write)
app/admin/suppliers/actions.ts -> Suppliers (write)
app/admin/users/actions.ts -> Users (write)
app/pos/actions.ts -> POS_Drafts (write)
app/pos/actions.ts -> Pos_Sync_Failures (write)
lib/manual-issue-transaction.ts -> issue_slips (write)
lib/manual-issue-transaction.ts -> stock_issues (write)
lib/product-erase-transaction.ts -> product_price_history (write)
lib/product-erase-transaction.ts -> product_variants (write)
lib/product-erase-transaction.ts -> products (write)
lib/product-save-transaction.ts -> product_price_history (write)
lib/product-save-transaction.ts -> product_variants (write)
lib/product-save-transaction.ts -> products (write)
lib/product-save-transaction.ts -> recipes (write)
lib/purchase-order-transaction.ts -> purchase_order_lines (write)
lib/purchase-order-transaction.ts -> purchase_orders (write)
lib/stock-adjustment-transaction.ts -> stock_adjustments (write)
lib/stocktake-transaction.ts -> stock_issues (write)
lib/stocktake-transaction.ts -> stocktake_lines (write)
lib/stocktake-transaction.ts -> stocktake_sessions (write)
lib/void-order-transaction.ts -> order_events (write)
lib/void-order-transaction.ts -> orders_v2 (write)
```

## Tables
- asset_depreciation_bands (id, min_unit_price, max_unit_price, term_months, status, created_at, updated_at)
- asset_disposals (id, asset_id, quantity, disposed_date, reason, created_by_id, created_by_name, created_at)
- assets (id, purchased_item_id, purchase_order_line_id, name_snapshot, acquired_date, unit_cost, quantity, term_months, status, created_at, updated_at, total_cost)
- brands (id, name, code, start_date, status, created_at, updated_at) status: ACTIVE, INACTIVE, DELETED
- data_migration_runs (migration_key, source_hash, snapshot_id, manifest_sha256, before_image, write_set, applied_at)
- data_recovery_changes (run_id, table_name, row_id, column_name, old_value, new_value, source_hash, applied_at, rolled_back_at)
- issue_slips (id, issued_at, note, created_by_id, created_by_name, created_at)
- item_categories (id, name, system_type, status, created_at) status: ACTIVE, INACTIVE, DELETED
- modifiers (id, name, group_name, price, status, sort_order, created_at, updated_at) status: ACTIVE, INACTIVE, DELETED
- order_events (id, order_id, event_type, event_at, actor_id, actor_name, from_version, to_version, previous_order_id, delta_json, reason)
- order_lines_v2 (id, order_id, line_no, product_id, product_snapshot_json, variant_id, variant_snapshot_json, qty, unit_price, modifiers_snapshot_json, gross_line_total, promo_discount, manual_item_discount, order_discount_allocation, net_line_total, cost_at_sale, recipe_snapshot_json, promo_discount_reason, manual_discount_reason, created_at)
- order_payments (id, order_id, method, amount, reference, created_at)
- orders_v2 (id, order_no, brand_id, status, version, parent_order_id, superseded_by, created_at, created_by_id, created_by_name, completed_at, voided_at, voided_by_id, void_reason, currency, gross_total, promo_discount_total, manual_item_discount_total, manual_order_discount, net_total, applied_promotion_id, applied_promotion_snapshot_json, pos_snapshot_json, payment_method, payment_ref, migration_notes, updated_at, client_request_id, synced_at, outlet_id) status: DRAFT, COMPLETED, SUPERSEDED, VOIDED
- outlets (id, code, name, brand_id, address, status, start_date, end_date, created_at, updated_at, open_time)
- pos_drafts (id, cart_json, status, created_at, updated_at, timestamp, outlet_id) status: OPEN, SUBMITTED, ABANDONED
- pos_sync_failures (id, request_token, cart_payload_json, error_message, occurred_at, resolved)
- product_categories (id, name, status, created_at) status: ACTIVE, INACTIVE, DELETED
- product_price_history (id, variant_id, old_price, new_price, reason, effective_at, created_at)
- product_variants (id, product_id, size_name, price, sort_order, status, created_at, updated_at) status: ACTIVE, INACTIVE, DELETED
- production_items (id, production_order_id, ingredient_id, ingredient_type, quantity, unit_id, created_at)
- production_orders (id, semi_product_id, batch_yield, status, notes, created_by_id, created_by_name, created_at, completed_at) status: PENDING, COMPLETED, CANCELLED
- products (id, name, category_id, brand_id, description, status, image_url, sort_order, created_at, updated_at, duplicate_warning_confirmed) status: ACTIVE, INACTIVE, DELETED
- promotions (id, name, brand_id, code, type, discount_type, discount_value, applicable_products_json, start_date, end_date, status, created_at, updated_at, min_order_value) status: ACTIVE, INACTIVE, DELETED
- purchase_order_edits (id, purchase_order_id, edited_by_id, edited_by_name, edited_at, previous_status, previous_subtotal_amount, previous_line_count, new_subtotal_amount, new_line_count)
- purchase_order_lines (id, purchase_order_id, purchased_item_id, unit, quantity, unit_price, subtotal, conversion_id, base_unit, base_quantity, created_at)
- purchase_orders (id, supplier_id, source_id, transaction_date, supplier_invoice_code, notes, subtotal_amount, shipping_fee, tax_amount, voucher_amount, discount_amount, total_amount, status, created_by_id, created_by_name, created_at, updated_at) status: DRAFT, COMPLETED, CANCELLED
- purchase_sources (id, name, status, created_at) status: ACTIVE, INACTIVE, DELETED
- purchased_items (id, name, item_category_id, base_ingredient_id, semi_product_id, default_unit_id, status, created_at, updated_at, duplicate_warning_confirmed, is_non_inventory) status: ACTIVE, INACTIVE, DELETED
- recipes (id, target_type, target_id, ingredients_json, start_date, end_date, status, created_at, updated_at) status: ACTIVE, INACTIVE, DELETED
- semi_products (id, name, base_unit, batch_yield, status, created_at, updated_at, duplicate_warning_confirmed) status: ACTIVE, INACTIVE, DELETED
- shift_stock_checks (id, shift_id, item_reference, checkpoint, counted_qty, theoretical_qty, variance, checked_by_id, checked_by_name, checked_at)
- shifts (id, status, opened_by_id, opened_by_name, opened_at, closed_by_id, closed_by_name, closed_at, notes, created_at, updated_at) status: OPEN, CLOSED
- stock_adjustments (id, reason, created_by_id, created_by_name, status, created_at, approved_at, notes, item_reference) status: PENDING, APPROVED, REJECTED
- stock_issues (id, purchased_item_id, issued_at, base_quantity, source, session_id, note, created_at, reverses_issue_id, issue_slip_id)
- stocktake_lines (id, session_id, item_reference, item_type, counted_qty, theoretical_at_count, counted_at, and)
- stocktake_sessions (id, status, created_by_id, created_by_name, created_at, confirmed_by_id, confirmed_by_name, confirmed_at, notes, updated_at, reversed_by_id) status: OPEN, CONFIRMED, CANCELLED
- suppliers (id, name, tax_id, address, links, status, created_at, phone, duplicate_warning_confirmed) status: ACTIVE, INACTIVE, DELETED
- sync_state (sync_key, last_synced_at, notes, updated_at)
- units (id, name, abbreviation, status, created_at, description) status: ACTIVE, INACTIVE, DELETED
- uom_conversions (id, purchased_item_id, base_unit, purchased_unit, conversion_rate, status, created_at, updated_at, purchase_only) status: ACTIVE, INACTIVE, DELETED
- users (id, username, password_hash, name, role, status, created_at, updated_at) status: ACTIVE, INACTIVE, DELETED

## UNRESOLVED write-sites (need a human)
- app/admin/users/actions.ts: update(...) with a non-literal table argument: only if non-blank
