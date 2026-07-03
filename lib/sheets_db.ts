/**
 * Database adapter — Supabase implementation.
 *
 * Claude code — Supabase migration Phase B.
 *
 * Replaces Google Sheets implementation. Same exports/signatures as before
 * so callers (server actions, scripts, lib) don't need changes.
 *
 * Sheet name resolution: code uses PascalCase (e.g. "Orders_V2") but
 * Postgres stores as lowercase. We lowercase before querying.
 *
 * Cache layer: unstable_cache with tag `sheets-<SheetName>` preserved
 * so existing revalidateTag calls in app/api/revalidate/route.ts work
 * unchanged.
 *
 * CLI_MODE: scripts bypass cache (same as Sheets impl).
 */

import { unstable_cache, revalidateTag } from 'next/cache';
import { getSupabaseClient } from './supabase';

// ============================================================================
// Sheet name normalization (PascalCase → lowercase table name)
// ============================================================================

function normalizeTableName(sheetName: string): string {
  return sheetName.toLowerCase();
}

// ============================================================================
// Cache helpers (preserved from Sheets impl)
// ============================================================================

const getCacheTag = (sheetName: string) => `sheets-${sheetName}`;

// Claude code — Supabase migration perf: cache TTL bumped.
// Postgres data changes less often than Sheets did. Writes call
// revalidateTag to invalidate on mutation, so longer TTL is safe.
// Static (reference) tables: 30 min. Catalog: 10 min. Transactions: 2 min.
const STATIC_SHEETS = new Set([
  'Units', 'Item_Categories', 'Product_Categories', 'Brands',
  'Suppliers', 'Users',
]);
const CATALOG_SHEETS = new Set([
  'Products', 'Product_Variants', 'Modifiers', 'Recipes', 'Promotions',
  'Base_Ingredients', 'Semi_Products', 'Purchased_Items', 'UOM_Conversions',
  'Product_Price_History',
]);
const getRevalidation = (sheetName: string) => {
  if (STATIC_SHEETS.has(sheetName)) return 1800;  // 30 min
  if (CATALOG_SHEETS.has(sheetName)) return 600;  // 10 min
  return 120;  // 2 min for transactions (Orders, Lines, Events, Ledger, etc.)
};

// ============================================================================
// Deprecated Google Sheets exports (kept for back-compat with scripts that
// bypass the abstraction). Will be removed in Phase F.
// ============================================================================

/**
 * @deprecated Supabase migration Phase B. Use getSupabaseClient() from
 * lib/supabase.ts instead. This throws at runtime; returns `any` so legacy
 * bypass callers compile (Phase F cleanup will rewrite them).
 */
export function getAuth(): any {
  throw new Error(
    'getAuth() is deprecated after Supabase migration. Update caller to use lib/supabase.ts.'
  );
}

/**
 * @deprecated Supabase migration Phase B. Use getSupabaseClient() instead.
 * Throws at runtime; returns `any` for legacy bypass compile compat.
 */
export const getSheetsClient = (): any => {
  throw new Error(
    'getSheetsClient() is deprecated after Supabase migration. Update caller to use lib/supabase.ts.'
  );
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Serialize row values to match legacy Sheets-impl behavior:
 * - Dates stored as ISO strings (Supabase returns Date objects for timestamptz).
 * - Booleans as-is (Sheets stored as string "TRUE"/"FALSE", now real boolean).
 * - Numbers as-is.
 * - JSON columns: Sheets stored as JSON string, Supabase as jsonb object. Convert to string for back-compat with JSON.parse callers.
 */
function serializeRow(
  row: any,
  jsonColumns: Set<string>,
  booleanColumns: Set<string>,
): any {
  if (!row) return row;
  const out: any = {};
  for (const [key, value] of Object.entries(row)) {
    if (booleanColumns.has(key) && typeof value === "boolean") {
      out[key] = value ? "TRUE" : "FALSE";
    } else if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (jsonColumns.has(key)) {
      if (value === null) {
        out[key] = "";
      } else if (typeof value === 'object') {
        const str = JSON.stringify(value);
        if (str === "{}" || str === "[]") {
          out[key] = "";
        } else {
          out[key] = str;
        }
      } else {
        out[key] = value;
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}

// Known JSON columns stored as jsonb in Postgres. Callers expect string for JSON.parse.
const JSON_COLUMNS_BY_TABLE: Record<string, Set<string>> = {
  orders_v2: new Set([
    'applied_promotion_snapshot_json',
    'pos_snapshot_json',
  ]),
  order_lines_v2: new Set([
    'product_snapshot_json',
    'variant_snapshot_json',
    'modifiers_snapshot_json',
    'recipe_snapshot_json',
  ]),
  order_events: new Set(['delta_json']),
  recipes: new Set(['ingredients_json']),
  promotions: new Set(['applicable_products_json']),
  pos_drafts: new Set(['cart_json']),
};

const BOOLEAN_COLUMNS_BY_TABLE: Record<string, Set<string>> = {
  base_ingredients: new Set(["is_non_inventory"]),
};

function getJsonColumns(tableName: string): Set<string> {
  return JSON_COLUMNS_BY_TABLE[tableName] || new Set();
}

function getBooleanColumns(tableName: string): Set<string> {
  return BOOLEAN_COLUMNS_BY_TABLE[tableName] || new Set();
}

// ============================================================================
// Read APIs
// ============================================================================

// Supabase/PostgREST caps responses at 1000 rows in this project. The client
// page size must match that cap or a short response can be mistaken for EOF.
const PAGE_SIZE = 1000;

export interface SheetFilter {
  gte?: Record<string, string | number | Date>;
  lte?: Record<string, string | number | Date>;
  eq?: Record<string, string | number>;
  in?: Record<string, Array<string | number>>;
  order?: { column: string; ascending?: boolean };
  limit?: number;
}

export const findAll = (sheetName: string) => {
  if (process.env.CLI_MODE === 'true') {
    return findAllNoCache(sheetName);
  }

  const tag = getCacheTag(sheetName);
  const reval = getRevalidation(sheetName);
  return unstable_cache(
    async (name: string) => {
      return findAllNoCache(name);
    },
    ['sheets-findall', sheetName],
    { revalidate: reval, tags: [tag] }
  )(sheetName);
};

export const findAllNoCache = async (sheetName: string) => {
  const supabase = getSupabaseClient();
  const tableName = normalizeTableName(sheetName);
  const jsonCols = getJsonColumns(tableName);
  const booleanCols = getBooleanColumns(tableName);
  // Skip serialization when the table has no legacy JSON/boolean columns.
  const needsSerialize = jsonCols.size > 0 || booleanCols.size > 0;
  const all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) {
      throw new Error(`findAll(${sheetName}): ${error.message}`);
    }
    if (!data || data.length === 0) break;
    if (needsSerialize) {
      for (const row of data) all.push(serializeRow(row, jsonCols, booleanCols));
    } else {
      for (const row of data) all.push(row);
    }
    if (data.length < PAGE_SIZE) break;
    page += 1;
  }
  return all;
};

function normalizeFilterValue(value: string | number | Date): string | number {
  return value instanceof Date ? value.toISOString() : value;
}

export async function findAllWhere<T = any>(
  sheetName: string,
  filters: SheetFilter,
): Promise<T[]> {
  if (filters.limit !== undefined && filters.limit <= 0) return [];

  const supabase = getSupabaseClient();
  const tableName = normalizeTableName(sheetName);
  const jsonCols = getJsonColumns(tableName);
  const booleanCols = getBooleanColumns(tableName);
  const needsSerialize = jsonCols.size > 0 || booleanCols.size > 0;
  const all: T[] = [];
  let offset = 0;

  while (filters.limit === undefined || all.length < filters.limit) {
    const remaining = filters.limit === undefined ? PAGE_SIZE : filters.limit - all.length;
    const pageSize = Math.min(PAGE_SIZE, remaining);
    let query: any = supabase.from(tableName).select("*");

    for (const [column, value] of Object.entries(filters.gte || {})) {
      query = query.gte(column, normalizeFilterValue(value));
    }
    for (const [column, value] of Object.entries(filters.lte || {})) {
      query = query.lte(column, normalizeFilterValue(value));
    }
    for (const [column, value] of Object.entries(filters.eq || {})) {
      query = query.eq(column, value);
    }
    for (const [column, values] of Object.entries(filters.in || {})) {
      query = query.in(column, values);
    }
    if (filters.order) {
      query = query.order(filters.order.column, {
        ascending: filters.order.ascending ?? true,
      });
    }

    const { data, error } = await query
      .limit(pageSize)
      .range(offset, offset + pageSize - 1);
    if (error) {
      throw new Error(`findAllWhere(${sheetName}): ${error.message}`);
    }
    if (!data || data.length === 0) break;

    if (needsSerialize) {
      for (const row of data) all.push(serializeRow(row, jsonCols, booleanCols));
    } else {
      for (const row of data) all.push(row);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

export async function findById(sheetName: string, id: string) {
  const supabase = getSupabaseClient();
  const tableName = normalizeTableName(sheetName);
  const jsonCols = getJsonColumns(tableName);
  const booleanCols = getBooleanColumns(tableName);
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    throw new Error(`findById(${sheetName}, ${id}): ${error.message}`);
  }
  return data ? serializeRow(data, jsonCols, booleanCols) : null;
}

export const getHeadersNoCache = async (sheetName: string): Promise<string[]> => {
  const supabase = getSupabaseClient();
  const tableName = normalizeTableName(sheetName);
  // Use PostgREST OpenAPI to get columns. Cheaper than full row select.
  // Fallback: SELECT * LIMIT 0 to get column names.
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);
  if (error) {
    throw new Error(`getHeaders(${sheetName}): ${error.message}`);
  }
  if (!data || data.length === 0) return [];
  return Object.keys(data[0]);
};

export const getHeaders = (sheetName: string) => {
  if (process.env.CLI_MODE === 'true') {
    return getHeadersNoCache(sheetName);
  }

  const tag = getCacheTag(sheetName);
  return unstable_cache(
    async (name: string): Promise<string[]> => {
      return getHeadersNoCache(name);
    },
    ['sheets-headers', sheetName],
    { revalidate: 3600, tags: [tag] }
  )(sheetName);
};

// ============================================================================
// ID generation
// ============================================================================

export async function generateNewId(sheetName: string, prefix: string): Promise<string> {
  // V2 sheets use crypto.randomUUID() (no prefix). Legacy uses PREFIX-###.
  // For legacy, find max existing numeric suffix.
  const all = await findAllNoCache(sheetName);
  if (all.length === 0) return `${prefix}-001`;

  let maxNum = 0;
  for (const item of all) {
    if (item.id && typeof item.id === 'string' && item.id.startsWith(prefix)) {
      const numStr = item.id.replace(`${prefix}-`, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    }
  }
  const nextNum = maxNum + 1;
  return `${prefix}-${nextNum.toString().padStart(3, '0')}`;
}

// ============================================================================
// Write APIs
// ============================================================================

/**
 * Convert data object for Supabase insert/update.
 * - String JSON values → parse to object (Postgres jsonb).
 * - Empty string → null (Postgres NOT NULL friendly).
 */
function deserializeRow(
  data: any,
  jsonColumns: Set<string>,
  booleanColumns: Set<string>,
): any {
  const out: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (booleanColumns.has(key) && typeof value === "string") {
      const normalized = value.toUpperCase();
      out[key] = normalized === "TRUE"
        ? true
        : normalized === "FALSE"
          ? false
          : value;
    } else if (jsonColumns.has(key) && typeof value === 'string' && value.length > 0) {
      try {
        out[key] = JSON.parse(value);
      } catch {
        out[key] = value;
      }
    } else if (value === '') {
      // Empty string becomes null for optional fields.
      if (jsonColumns.has(key)) {
        out[key] = {}; // Satisfy Postgres jsonb NOT NULL constraint
      } else {
        out[key] = null;
      }
    } else {
      out[key] = value;
    }
  }
  return out;
}

function touchRevalidate(sheetName: string) {
  try {
    revalidateTag(getCacheTag(sheetName));
  } catch {
    // Ignore if not in Next.js context (scripts).
  }
}

export async function insert(sheetName: string, data: any) {
  const supabase = getSupabaseClient();
  const tableName = normalizeTableName(sheetName);
  const jsonCols = getJsonColumns(tableName);
  const booleanCols = getBooleanColumns(tableName);
  const payload = deserializeRow(data, jsonCols, booleanCols);

  const { data: inserted, error } = await supabase
    .from(tableName)
    .insert(payload)
    .select()
    .single();
  if (error) {
    throw new Error(`insert(${sheetName}): ${error.message}`);
  }
  touchRevalidate(sheetName);
  return serializeRow(inserted, jsonCols, booleanCols);
}

export async function insertMany(sheetName: string, dataArray: any[]) {
  if (!dataArray || dataArray.length === 0) return [];

  const supabase = getSupabaseClient();
  const tableName = normalizeTableName(sheetName);
  const jsonCols = getJsonColumns(tableName);
  const booleanCols = getBooleanColumns(tableName);
  const payload = dataArray.map(d => deserializeRow(d, jsonCols, booleanCols));

  const { data: inserted, error } = await supabase
    .from(tableName)
    .insert(payload)
    .select();
  if (error) {
    throw new Error(`insertMany(${sheetName}): ${error.message}`);
  }
  touchRevalidate(sheetName);
  return (inserted || []).map((row: any) => serializeRow(row, jsonCols, booleanCols));
}

export async function update(sheetName: string, id: string, data: any) {
  const supabase = getSupabaseClient();
  const tableName = normalizeTableName(sheetName);
  const jsonCols = getJsonColumns(tableName);
  const booleanCols = getBooleanColumns(tableName);
  const payload = deserializeRow(data, jsonCols, booleanCols);

  const { data: updated, error } = await supabase
    .from(tableName)
    .update(payload)
    .eq('id', id)
    .select()
    .single();
  if (error) {
    throw new Error(`update(${sheetName}, ${id}): ${error.message}`);
  }
  touchRevalidate(sheetName);
  return serializeRow(updated, jsonCols, booleanCols);
}

export async function updateMany(sheetName: string, dataArray: any[]) {
  if (!dataArray || dataArray.length === 0) return [];

  const supabase = getSupabaseClient();
  const tableName = normalizeTableName(sheetName);
  const jsonCols = getJsonColumns(tableName);
  const booleanCols = getBooleanColumns(tableName);

  // Postgres update by primary key in parallel. Callers guarantee unique IDs.
  // Supabase JS doesn't have native batch update; use Promise.all.
  const results = await Promise.all(
    dataArray.map(async (data) => {
      const id = data?.id;
      if (!id) throw new Error(`updateMany(${sheetName}): missing id in ${JSON.stringify(data)}`);
      const payload = deserializeRow(data, jsonCols, booleanCols);
      const { data: updated, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        throw new Error(`updateMany(${sheetName}, ${id}): ${error.message}`);
      }
      return serializeRow(updated, jsonCols, booleanCols);
    })
  );
  touchRevalidate(sheetName);
  return results;
}

export async function remove(sheetName: string, id: string) {
  const supabase = getSupabaseClient();
  const tableName = normalizeTableName(sheetName);
  const { error } = await supabase
    .from(tableName)
    .delete()
    .eq('id', id);
  if (error) {
    throw new Error(`remove(${sheetName}, ${id}): ${error.message}`);
  }
  touchRevalidate(sheetName);
  return true;
}

export async function removeMany(sheetName: string, ids: string[]) {
  if (!ids || ids.length === 0) return true;

  const supabase = getSupabaseClient();
  const tableName = normalizeTableName(sheetName);
  const { error } = await supabase
    .from(tableName)
    .delete()
    .in('id', ids);
  if (error) {
    throw new Error(`removeMany(${sheetName}, ${ids.length} ids): ${error.message}`);
  }
  touchRevalidate(sheetName);
  return true;
}
