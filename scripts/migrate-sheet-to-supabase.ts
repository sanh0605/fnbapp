/**
 * Migrate data from Google Sheets → Supabase for one sheet.
 *
 * Claude code — Supabase migration Phase C.
 *
 * Usage:
 *   vite-node scripts/migrate-sheet-to-supabase.ts <SheetName>          # dry-run
 *   vite-node scripts/migrate-sheet-to-supabase.ts <SheetName> --apply  # write
 *
 * Behavior:
 *   - Reads source rows from Google Sheets via lib/sheets-source.ts.
 *   - Reads existing IDs from Supabase target table.
 *   - Computes diff: missing IDs (need insert).
 *   - Dry-run prints count + sample.
 *   - --apply inserts missing rows. Idempotent: re-run = 0 inserts.
 *   - Writes audit JSON to docs/audits/<date>-supabase-migration-<sheet>.json.
 *
 * Per protocol rule 1 (No silent data writes): default dry-run, --apply required.
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
dotenv.config({ path: '.env.local' });
process.env.CLI_MODE = 'true';

// JSON columns per table (Postgres jsonb). Values from Sheets are stringified JSON.
const JSON_COLUMNS: Record<string, string[]> = {
  orders_v2: ['applied_promotion_snapshot_json', 'pos_snapshot_json'],
  order_lines_v2: [
    'product_snapshot_json',
    'variant_snapshot_json',
    'modifiers_snapshot_json',
    'recipe_snapshot_json',
  ],
  order_events: ['delta_json'],
  recipes: ['ingredients_json'],
  promotions: ['applicable_products_json'],
  pos_drafts: ['cart_json'],
};

// Boolean columns per table (Sheets stores "TRUE"/"FALSE" string).
const BOOLEAN_COLUMNS: Record<string, string[]> = {
  base_ingredients: ['is_non_inventory'],
};

function normalizeTableName(sheetName: string): string {
  return sheetName.toLowerCase();
}

function transformRow(
  rawRow: Record<string, string>,
  tableName: string,
): Record<string, unknown> {
  const jsonCols = new Set(JSON_COLUMNS[tableName] || []);
  const boolCols = new Set(BOOLEAN_COLUMNS[tableName] || []);
  // For columns with server-side DEFAULT (now()): if source is empty,
  // use current ISO timestamp instead of relying on DEFAULT (Supabase
  // PostgREST sometimes passes null explicitly even when omitted).
  const nowIso = new Date().toISOString();
  const fillNowIfEmpty = new Set(['created_at', 'updated_at', 'event_at', 'completed_at', 'approved_at', 'transaction_date', 'effective_at']);
  // Required columns with no DEFAULT that must have non-null value.
  const defaultsIfEmpty: Record<string, unknown> = {
    is_non_inventory: false,
    is_active: true,
    status: 'ACTIVE',
    currency: 'VND',
    version: 1,
    line_no: 1,
    qty: 1,
    currency_code: 'VND',
    new_price: 0,
    gross_total: 0,
    net_total: 0,
    gross_line_total: 0,
    net_line_total: 0,
    cost_at_sale: 0,
    unit_price: 0,
    price: 0,
  };
  // JSONB columns with DEFAULT '[]' or '{}' — inject as object/array literal.
  const jsonDefaults: Record<string, unknown> = {
    applied_promotion_snapshot_json: {},
    pos_snapshot_json: {},
    modifiers_snapshot_json: [],
    product_snapshot_json: {},
    variant_snapshot_json: {},
    recipe_snapshot_json: {},
    delta_json: {},
    ingredients_json: [],
    applicable_products_json: [],
    cart_json: {},
  };
  // Money (bigint) columns that may arrive as decimal — round to integer.
  const moneyColumns = new Set([
    'gross_total', 'promo_discount_total', 'manual_item_discount_total',
    'manual_order_discount', 'net_total', 'gross_line_total', 'promo_discount',
    'manual_item_discount', 'order_discount_allocation', 'net_line_total',
    'cost_at_sale', 'unit_price', 'subtotal_amount', 'shipping_fee',
    'tax_amount', 'voucher_amount', 'discount_amount', 'total_amount',
    'subtotal', 'price', 'new_price', 'old_price',
  ]);
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(rawRow)) {
    // Apply column rename (source uses old name, target uses new).
    const key = COLUMN_RENAMES[rawKey] || rawKey;
    if (value === '' || value === undefined) {
      if (fillNowIfEmpty.has(key)) {
        out[key] = nowIso;
      } else if (key in defaultsIfEmpty) {
        out[key] = defaultsIfEmpty[key];
      } else if (key in jsonDefaults) {
        out[key] = jsonDefaults[key];
      } else {
        out[key] = null;
      }
      continue;
    }
    // Round money columns with decimals to integer (bigint).
    if (
      moneyColumns.has(key) &&
      typeof value === 'string' &&
      /^-?\d+(\.\d+)?$/.test(value)
    ) {
      out[key] = Math.round(Number(value));
      continue;
    }
    if (jsonCols.has(key)) {
      try {
        out[key] = JSON.parse(value);
      } catch {
        out[key] = value;
      }
      continue;
    }
    if (boolCols.has(key)) {
      out[key] = value === 'TRUE' || value === 'true' || value === '1';
      continue;
    }
    if (
      typeof value === 'string' &&
      /^-?\d+$/.test(value) &&
      (key.endsWith('_total') || key.endsWith('_amount') || key.endsWith('_fee') ||
        key.endsWith('_discount') || key.endsWith('_allocation') || key === 'cost_at_sale' ||
        key === 'unit_price' || key === 'price' || key === 'quantity' || key === 'qty' ||
        key === 'version' || key === 'line_no' || key === 'sort_order' ||
        key === 'batch_yield' || key === 'conversion_rate' || key === 'factor' ||
        key === 'subtotal' || key === 'tax_amount')
    ) {
      const num = Number(value);
      if (Number.isFinite(num)) {
        out[key] = num;
        continue;
      }
    }
    if (
      typeof value === 'string' &&
      /^-?\d+(\.\d+)?$/.test(value) &&
      (key === 'quantity_change' || key === 'unit_cost' || key === 'base_quantity')
    ) {
      const num = Number(value);
      if (Number.isFinite(num)) {
        out[key] = num;
        continue;
      }
    }
    out[key] = value;
  }
  // Inject defaults for required columns that may not exist in source Sheets.
  for (const [defaultKey, defaultValue] of Object.entries(defaultsIfEmpty)) {
    if (!(defaultKey in out) || out[defaultKey] === null || out[defaultKey] === undefined) {
      out[defaultKey] = defaultValue;
    }
  }
  // Inject JSONB defaults for missing/null snapshot columns.
  for (const [jsonKey, jsonDefault] of Object.entries(jsonDefaults)) {
    if (jsonKey in out && (out[jsonKey] === null || out[jsonKey] === undefined)) {
      out[jsonKey] = jsonDefault;
    }
  }
  return out;
}

// Source → target column renames (Sheets uses different name than Supabase schema).
const COLUMN_RENAMES: Record<string, string> = {
  po_id: 'purchase_order_id',
  outlet_id: 'brand_id',
};

// Hardcoded column allowlist per table (source of truth: supabase/migrations/0001_init_schema.sql).
// Source Sheets often have extra historical columns not in target schema — drop them.
const TARGET_COLUMNS: Record<string, string[]> = {
  brands: ['id', 'name', 'code', 'start_date', 'status', 'created_at', 'updated_at'],
  product_categories: ['id', 'name', 'status', 'created_at'],
  item_categories: ['id', 'name', 'system_type', 'status', 'created_at'],
  units: ['id', 'name', 'abbreviation', 'status', 'created_at'],
  suppliers: ['id', 'name', 'tax_id', 'address', 'links', 'status', 'created_at'],
  purchase_sources: ['id', 'name', 'status', 'created_at'],
  users: ['id', 'username', 'password_hash', 'name', 'role', 'status', 'created_at', 'updated_at'],
  products: ['id', 'name', 'category_id', 'brand_id', 'description', 'status', 'image_url', 'sort_order', 'created_at', 'updated_at'],
  product_variants: ['id', 'product_id', 'size_name', 'price', 'sort_order', 'status', 'created_at', 'updated_at'],
  modifiers: ['id', 'name', 'group_name', 'price', 'status', 'sort_order', 'created_at', 'updated_at'],
  recipes: ['id', 'target_type', 'target_id', 'ingredients_json', 'start_date', 'end_date', 'status', 'created_at', 'updated_at'],
  promotions: ['id', 'name', 'brand_id', 'code', 'type', 'discount_type', 'discount_value', 'applicable_products_json', 'start_date', 'end_date', 'status', 'created_at', 'updated_at'],
  base_ingredients: ['id', 'name', 'base_unit', 'is_non_inventory', 'status', 'created_at', 'updated_at'],
  semi_products: ['id', 'name', 'base_unit', 'batch_yield', 'status', 'created_at', 'updated_at'],
  purchased_items: ['id', 'name', 'item_category_id', 'base_ingredient_id', 'semi_product_id', 'default_unit_id', 'status', 'created_at', 'updated_at'],
  uom_conversions: ['id', 'purchased_item_id', 'base_unit', 'purchased_unit', 'conversion_rate', 'status', 'created_at', 'updated_at'],
  product_price_history: ['id', 'variant_id', 'old_price', 'new_price', 'reason', 'effective_at', 'created_at'],
  orders_v2: ['id', 'order_no', 'brand_id', 'status', 'version', 'parent_order_id', 'superseded_by', 'created_at', 'created_by_id', 'created_by_name', 'completed_at', 'voided_at', 'voided_by_id', 'void_reason', 'currency', 'gross_total', 'promo_discount_total', 'manual_item_discount_total', 'manual_order_discount', 'net_total', 'applied_promotion_id', 'applied_promotion_snapshot_json', 'pos_snapshot_json', 'payment_method', 'payment_ref', 'migration_notes', 'updated_at'],
  order_lines_v2: ['id', 'order_id', 'line_no', 'product_id', 'product_snapshot_json', 'variant_id', 'variant_snapshot_json', 'qty', 'unit_price', 'modifiers_snapshot_json', 'gross_line_total', 'promo_discount', 'manual_item_discount', 'order_discount_allocation', 'net_line_total', 'cost_at_sale', 'recipe_snapshot_json', 'promo_discount_reason', 'manual_discount_reason', 'created_at'],
  order_events: ['id', 'order_id', 'event_type', 'event_at', 'actor_id', 'actor_name', 'from_version', 'to_version', 'previous_order_id', 'delta_json', 'reason'],
  stock_ledger: ['id', 'item_reference', 'transaction_type', 'quantity_change', 'unit_cost', 'reference_id', 'source', 'notes', 'created_at'],
  purchase_orders: ['id', 'supplier_id', 'source_id', 'transaction_date', 'supplier_invoice_code', 'notes', 'subtotal_amount', 'shipping_fee', 'tax_amount', 'voucher_amount', 'discount_amount', 'total_amount', 'status', 'created_by_id', 'created_by_name', 'created_at', 'updated_at'],
  purchase_order_lines: ['id', 'purchase_order_id', 'purchased_item_id', 'unit', 'quantity', 'unit_price', 'subtotal', 'conversion_id', 'base_unit', 'base_quantity', 'created_at'],
  stock_adjustments: ['id', 'reason', 'created_by_id', 'created_by_name', 'status', 'created_at', 'approved_at', 'notes'],
  production_orders: ['id', 'semi_product_id', 'batch_yield', 'status', 'notes', 'created_by_id', 'created_by_name', 'created_at', 'completed_at'],
  production_items: ['id', 'production_order_id', 'ingredient_id', 'ingredient_type', 'quantity', 'unit_id', 'created_at'],
  pos_drafts: ['id', 'cart_json', 'status', 'created_at', 'updated_at'],
};

async function fetchTargetColumns(_supabase: any, tableName: string): Promise<Set<string>> {
  return new Set(TARGET_COLUMNS[tableName] || []);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const sheetName = args.find((a) => !a.startsWith('--'));
  if (!sheetName) {
    console.error('Usage: vite-node scripts/migrate-sheet-to-supabase.ts <SheetName> [--apply]');
    process.exit(1);
  }

  const tableName = normalizeTableName(sheetName);
  console.log(`=== MIGRATE ${sheetName} → ${tableName} (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);

  // 1. Read source from Sheets.
  const { readAllFromSheets } = await import('../lib/sheets-source');
  console.log(`Reading source from Google Sheets...`);
  const { headers, rows: sourceRows } = await readAllFromSheets(sheetName);
  console.log(`Source rows: ${sourceRows.length}, columns: ${headers.length}`);

  if (sourceRows.length === 0) {
    console.log('No source rows. Nothing to migrate.');
    return;
  }

  // 2. Read existing IDs from Supabase target (with pagination, default PostgREST limit is 1000).
  const { getSupabaseClient } = await import('../lib/supabase');
  const supabase = getSupabaseClient();
  const existingIds = new Set<string>();
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data: pageData, error: pageError } = await supabase
      .from(tableName)
      .select('id')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (pageError) {
      console.error(`Supabase read failed (page ${page}): ${pageError.message}`);
      process.exit(1);
    }
    if (!pageData || pageData.length === 0) break;
    for (const r of pageData) existingIds.add(r.id);
    if (pageData.length < PAGE_SIZE) break;
    page += 1;
  }
  console.log(`Target existing rows: ${existingIds.size}`);

  // 2b. Discover target columns for filtering.
  const targetColumns = await fetchTargetColumns(supabase, tableName);
  if (targetColumns.size === 0) {
    console.log('Target table empty, accepting all source columns.');
  } else {
    const unknown = headers.filter((h) => !targetColumns.has(h));
    if (unknown.length > 0) {
      console.log(`Dropping unknown columns (not in target schema): ${unknown.join(', ')}`);
    }
  }

  // 3. Compute diff.
  let missing = sourceRows.filter((row) => {
    const id = row.id;
    return id && !existingIds.has(id);
  });
  const skippedNoId = sourceRows.filter((row) => !row.id);

  // 3b. For tables with FK to another migrated table, pre-fetch parent IDs
  //     and skip rows whose FK target doesn't exist (orphan data in source).
  const FK_PARENT_MAP: Record<string, { fkColumn: string; parentTable: string }> = {
    order_lines_v2: { fkColumn: 'order_id', parentTable: 'orders_v2' },
    order_events: { fkColumn: 'order_id', parentTable: 'orders_v2' },
    purchase_order_lines: { fkColumn: 'purchase_order_id', parentTable: 'purchase_orders' },
    product_variants: { fkColumn: 'product_id', parentTable: 'products' },
  };
  const fkConfig = FK_PARENT_MAP[tableName];
  let skippedOrphan = 0;
  if (fkConfig) {
    const parentIdKey = fkConfig.fkColumn === 'po_id' ? 'purchase_order_id' : fkConfig.fkColumn;
    const parentIds = new Set<string>();
    let ppage = 0;
    while (true) {
      const { data, error } = await supabase
        .from(fkConfig.parentTable)
        .select('id')
        .range(ppage * 1000, (ppage + 1) * 1000 - 1);
      if (error || !data || data.length === 0) break;
      for (const r of data) parentIds.add(r.id);
      if (data.length < 1000) break;
      ppage += 1;
    }
    const before = missing.length;
    missing = missing.filter((row) => {
      const fk = row[parentIdKey] || row[fkConfig.fkColumn];
      if (!fk) return false; // Null FK — skip (would fail NOT NULL).
      return parentIds.has(fk);
    });
    skippedOrphan = before - missing.length;
    console.log(`FK validation against ${fkConfig.parentTable}: ${skippedOrphan} orphan rows skipped`);
  }

  console.log(`Missing (to insert): ${missing.length}`);
  if (skippedNoId.length > 0) {
    console.log(`Skipped (no id): ${skippedNoId.length}`);
  }

  // 4. Transform rows for Supabase insert.
  const transformed = missing.map((row) => {
    const obj = transformRow(row, tableName);
    if (targetColumns.size > 0) {
      // Drop unknown columns.
      for (const key of Object.keys(obj)) {
        if (!targetColumns.has(key)) delete obj[key];
      }
    }
    return obj;
  });

  // 5. Print preview.
  if (transformed.length > 0) {
    console.log('\nSample (first 3 rows to insert):');
    for (const row of transformed.slice(0, 3)) {
      console.log(`  ${JSON.stringify(row).slice(0, 200)}${JSON.stringify(row).length > 200 ? '...' : ''}`);
    }
  }

  // 6. Write audit JSON.
  const today = new Date().toISOString().slice(0, 10);
  const auditPath = path.resolve(
    process.cwd(),
    `docs/audits/${today}-supabase-migration-${tableName}.json`,
  );
  const audit = {
    generated_at: new Date().toISOString(),
    mode: apply ? 'APPLY' : 'DRY-RUN',
    sheet_name: sheetName,
    table_name: tableName,
    source_count: sourceRows.length,
    target_existing_count: existingIds.size,
    missing_count: missing.length,
    skipped_no_id_count: skippedNoId.length,
    skipped_orphan_fk_count: skippedOrphan,
    inserted_count: apply ? transformed.length : 0,
    sample_missing_ids: missing.slice(0, 10).map((r) => r.id),
  };
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));
  console.log(`\nAudit: ${path.relative(process.cwd(), auditPath)}`);

  // 7. Apply if requested.
  if (!apply) {
    console.log('\nNo data was written. Re-run with --apply to insert.');
    return;
  }

  if (transformed.length === 0) {
    console.log('\n0 rows to insert. Already at parity.');
    return;
  }

  console.log(`\nInserting ${transformed.length} rows to Supabase...`);
  // Chunk large inserts to avoid PostgREST payload limits.
  const CHUNK_SIZE = 500;
  let insertedTotal = 0;
  for (let i = 0; i < transformed.length; i += CHUNK_SIZE) {
    const chunk = transformed.slice(i, i + CHUNK_SIZE);
    const { error: insertError } = await supabase
      .from(tableName)
      .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
    if (insertError) {
      console.error(`Upsert failed at chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${insertError.message}`);
      console.error('First row in failing chunk:', chunk[0]);
      process.exit(1);
    }
    insertedTotal += chunk.length;
    if (transformed.length > CHUNK_SIZE) {
      console.log(`  ...chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(transformed.length / CHUNK_SIZE)} done (${insertedTotal}/${transformed.length})`);
    }
  }

  // 8. Verify post-insert.
  const { data: postInsert, error: postError } = await supabase
    .from(tableName)
    .select('id');
  if (postError) {
    console.error(`Post-insert verify failed: ${postError.message}`);
    process.exit(1);
  }
  console.log(`Post-insert target count: ${(postInsert || []).length}`);
  console.log(`Delta: +${(postInsert || []).length - existingIds.size}`);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
