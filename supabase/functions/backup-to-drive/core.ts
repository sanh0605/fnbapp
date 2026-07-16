export const BACKUP_TABLES = [
  "brands",
  "product_categories",
  "item_categories",
  "units",
  "suppliers",
  "purchase_sources",
  "products",
  "product_variants",
  "modifiers",
  "recipes",
  "promotions",
  "base_ingredients",
  "semi_products",
  "purchased_items",
  "uom_conversions",
  "product_price_history",
  "orders_v2",
  "order_lines_v2",
  "order_events",
  "stock_ledger",
  "purchase_orders",
  "purchase_order_lines",
  "stock_adjustments",
  "production_orders",
  "production_items",
  "pos_drafts",
  "users",
] as const;

export const PAGE_SIZE = 1000;

export type JsonRow = Record<string, unknown>;

export type BackupBundle = {
  capturedAt: string;
  schemaVersion: 1;
  tables: Record<string, { rows: JsonRow[]; count: number }>;
};

export type SnapshotEnvironment = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

export type SnapshotSummary = {
  tableCount: number;
  totalRowCount: number;
};

export function buildBackupBundle(
  capturedAt: string,
  tableRows: Map<string, JsonRow[]>,
  tables: readonly string[] = BACKUP_TABLES,
): BackupBundle {
  const bundleTables: BackupBundle["tables"] = {};
  for (const table of tables) {
    const rows = tableRows.get(table) || [];
    bundleTables[table] = { rows, count: rows.length };
  }
  return { capturedAt, schemaVersion: 1, tables: bundleTables };
}

export function validateBackupBundle(bundle: BackupBundle): SnapshotSummary {
  if (bundle.schemaVersion !== 1) {
    throw new Error(`Unsupported backup schema version: ${bundle.schemaVersion}`);
  }
  const actualKeys = Object.keys(bundle.tables).sort();
  const expectedKeys = [...BACKUP_TABLES].sort();
  const missing = expectedKeys.filter(table => !actualKeys.includes(table));
  const unexpected = actualKeys.filter(table => !expectedKeys.includes(table as typeof BACKUP_TABLES[number]));
  if (missing.length > 0) throw new Error(`Backup is missing required tables: ${missing.join(", ")}`);
  if (unexpected.length > 0) throw new Error(`Backup contains unexpected tables: ${unexpected.join(", ")}`);

  let totalRowCount = 0;
  for (const table of BACKUP_TABLES) {
    const entry = bundle.tables[table];
    if (!Array.isArray(entry.rows) || entry.count !== entry.rows.length) {
      throw new Error(`Backup table ${table} has an invalid row count`);
    }
    totalRowCount += entry.count;
  }
  return { tableCount: BACKUP_TABLES.length, totalRowCount };
}

export function buildBackupFileName(capturedAt: string): string {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(capturedAt));
  return `fnbapp-backup-${date}.json`;
}

export async function dumpTable(
  env: SnapshotEnvironment,
  table: string,
  fetchImpl: typeof fetch = fetch,
): Promise<JsonRow[]> {
  if (!(BACKUP_TABLES as readonly string[]).includes(table)) {
    throw new Error(`Table is not in the backup allowlist: ${table}`);
  }
  const rows: JsonRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}?select=*&order=id.asc&offset=${offset}&limit=${PAGE_SIZE}`;
    const response = await fetchImpl(url, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(`${table} snapshot query failed (${response.status}): ${await response.text()}`);
    }
    const page = await response.json() as JsonRow[];
    if (!Array.isArray(page)) throw new Error(`${table} snapshot query returned a non-array payload`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function buildDatabaseSnapshot(
  env: SnapshotEnvironment,
  options: { capturedAt?: string; fetchImpl?: typeof fetch } = {},
): Promise<BackupBundle> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase URL or secret key");
  }
  const tableRows = new Map<string, JsonRow[]>();
  for (const table of BACKUP_TABLES) {
    tableRows.set(table, await dumpTable(env, table, options.fetchImpl || fetch));
  }
  const bundle = buildBackupBundle(options.capturedAt || new Date().toISOString(), tableRows);
  validateBackupBundle(bundle);
  return bundle;
}
