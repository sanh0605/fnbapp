import * as dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { auditMacCogsDrift, type MacCogsLineMismatch } from "../lib/mac-cogs-audit";
import {
  buildInventoryBalances,
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
} from "../lib/inventory-consumption";
import { parseLineRecipeSnapshot } from "../lib/order-types";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const JSON_REPORT_PATH = "docs/audits/2026-07-09-backdated-ledger-pattern.json";
const DOC_REPORT_PATH = "docs/audits/2026-07-09-backdated-ledger-pattern.md";
const PRECISE_TYPES = new Set(["PO_RECEIPT"]);
const PROXY_TYPES = new Set(["STOCK_ADJUST", "PRODUCTION_YIELD"]);
const DETECTION_TYPES = new Set(["PO_RECEIPT", "STOCK_ADJUST", "PRODUCTION_YIELD"]);
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type Row = Record<string, unknown>;

type StockLedgerRow = Row & {
  id?: string;
  item_reference?: string;
  transaction_type?: string;
  quantity_change?: string | number;
  unit_cost?: string | number;
  reference_id?: string;
  source?: string;
  created_at?: string;
};

type PurchaseOrderRow = Row & {
  id?: string;
  created_at?: string;
  transaction_date?: string;
  status?: string;
};

type OrderRow = Row & {
  id: string;
  order_no?: string;
  status?: string;
  superseded_by?: string;
  created_at?: string;
};

type OrderLineRow = Row & {
  id: string;
  order_id: string;
  product_id?: string;
  variant_id?: string;
  qty?: string | number;
  cost_at_sale?: string | number;
  recipe_snapshot_json?: string;
  modifiers_snapshot_json?: string;
};

type RecipeRow = Row & {
  target_id?: string;
  target_type?: string;
  ingredients_json?: string;
};

type SemiProductRow = Row & {
  id?: string;
  batch_yield?: string | number;
};

type BackdatedEntry = {
  stock_ledger_id: string;
  transaction_type: string;
  source_table: string;
  source_id: string;
  item_reference: string;
  quantity_change: number;
  unit_cost: number;
  effective_timestamp: string;
  visibility_timestamp: string;
  detection_method: "SOURCE_CREATED_AT" | "OLDER_THAN_ONE_DAY_PROXY";
  lag_minutes: number;
};

type ImpactLine = {
  line_id: string;
  order_id: string;
  order_no: string;
  sale_time: string;
  product_id: string;
  stored_cost: number;
  expected_cost: number;
  delta: number;
  matched_backdated_ledger_ids: string[];
};

type AuditReport = {
  generated_at: string;
  summary: {
    total_entries: number;
    precise_entries: number;
    proxy_entries: number;
    total_abs_drift_vnd: number;
    impacted_line_count: number;
  };
  counts_by_month: Array<{ month: string; count: number }>;
  counts_by_source_table: Array<{ source_table: string; count: number }>;
  top_item_references: Array<{ item_reference: string; count: number }>;
  entries: BackdatedEntry[];
  impact_lines: ImpactLine[];
};

async function main(): Promise<void> {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const [orders, lines, ledger, recipes, semiProducts, purchaseOrders] = await Promise.all([
    findAllNoCache("Orders_V2") as Promise<OrderRow[]>,
    findAllNoCache("Order_Lines_V2") as Promise<OrderLineRow[]>,
    findAllNoCache("Stock_Ledger") as Promise<StockLedgerRow[]>,
    findAllNoCache("Recipes") as Promise<RecipeRow[]>,
    findAllNoCache("Semi_Products") as Promise<SemiProductRow[]>,
    findAllNoCache("Purchase_Orders") as Promise<PurchaseOrderRow[]>,
  ]);

  const entries = findBackdatedEntries(ledger, purchaseOrders);
  const drift = auditMacCogsDrift({
    orders,
    lines,
    ledger,
    recipes,
    semiProducts,
  });
  const impactLines = findImpactLines(entries, drift.lineMismatches, {
    orders,
    lines,
    ledger,
    recipes,
    semiProducts,
  });
  const report = buildReport(entries, impactLines);

  writeJsonReport(JSON_REPORT_PATH, report);
  writeTextReport(DOC_REPORT_PATH, renderMarkdown(report));
  printSummary(report);
}

function findBackdatedEntries(
  ledger: StockLedgerRow[],
  purchaseOrders: PurchaseOrderRow[],
): BackdatedEntry[] {
  const purchaseOrderById = new Map(
    purchaseOrders
      .filter(row => stringValue(row.id))
      .map(row => [stringValue(row.id), row]),
  );
  const nowMs = Date.now();
  const entries: BackdatedEntry[] = [];

  for (const row of ledger) {
    const transactionType = stringValue(row.transaction_type);
    if (!DETECTION_TYPES.has(transactionType)) continue;

    const effectiveTimestamp = stringValue(row.created_at);
    const effectiveMs = timestampMs(effectiveTimestamp);
    if (!Number.isFinite(effectiveMs)) continue;

    if (PRECISE_TYPES.has(transactionType)) {
      const purchaseOrder = purchaseOrderById.get(stringValue(row.reference_id));
      if (!purchaseOrder) continue;
      const visibilityTimestamp = stringValue(purchaseOrder.created_at);
      const visibilityMs = timestampMs(visibilityTimestamp);
      if (!Number.isFinite(visibilityMs) || effectiveMs >= visibilityMs) continue;
      entries.push(toEntry(row, visibilityTimestamp, "SOURCE_CREATED_AT"));
      continue;
    }

    if (PROXY_TYPES.has(transactionType) && effectiveMs < nowMs - ONE_DAY_MS) {
      entries.push(toEntry(row, new Date(nowMs).toISOString(), "OLDER_THAN_ONE_DAY_PROXY"));
    }
  }

  return entries.sort((a, b) =>
    timestampMs(a.effective_timestamp) - timestampMs(b.effective_timestamp) ||
    a.stock_ledger_id.localeCompare(b.stock_ledger_id),
  );
}

function toEntry(
  row: StockLedgerRow,
  visibilityTimestamp: string,
  detectionMethod: BackdatedEntry["detection_method"],
): BackdatedEntry {
  const effectiveTimestamp = stringValue(row.created_at);
  const lagMinutes = Math.round(
    (timestampMs(visibilityTimestamp) - timestampMs(effectiveTimestamp)) / 60000,
  );
  return {
    stock_ledger_id: stringValue(row.id),
    transaction_type: stringValue(row.transaction_type),
    source_table: stringValue(row.source) || inferSourceTable(stringValue(row.transaction_type)),
    source_id: stringValue(row.reference_id),
    item_reference: stringValue(row.item_reference),
    quantity_change: numberValue(row.quantity_change),
    unit_cost: Math.round(numberValue(row.unit_cost)),
    effective_timestamp: effectiveTimestamp,
    visibility_timestamp: visibilityTimestamp,
    detection_method: detectionMethod,
    lag_minutes: lagMinutes,
  };
}

function findImpactLines(
  entries: BackdatedEntry[],
  mismatches: MacCogsLineMismatch[],
  source: {
    orders: OrderRow[];
    lines: OrderLineRow[];
    ledger: StockLedgerRow[];
    recipes: RecipeRow[];
    semiProducts: SemiProductRow[];
  },
): ImpactLine[] {
  const impactedByLine = new Map<string, ImpactLine>();
  const orderById = new Map(source.orders.map(order => [order.id, order]));
  const lineById = new Map(source.lines.map(line => [line.id, line]));
  const consumedItemsByLine = buildConsumedItemsByLine(mismatches, {
    orderById,
    lineById,
    ledger: source.ledger,
    recipes: source.recipes,
    semiProducts: source.semiProducts,
  });

  for (const entry of entries) {
    const effectiveMs = timestampMs(entry.effective_timestamp);
    const visibilityMs = timestampMs(entry.visibility_timestamp);
    if (!Number.isFinite(effectiveMs) || !Number.isFinite(visibilityMs)) continue;

    for (const mismatch of mismatches) {
      const saleMs = timestampMs(mismatch.created_at);
      if (saleMs < effectiveMs || saleMs > visibilityMs) continue;
      if (!consumedItemsByLine.get(mismatch.line_id)?.has(entry.item_reference)) continue;

      const existing = impactedByLine.get(mismatch.line_id) || {
        line_id: mismatch.line_id,
        order_id: mismatch.order_id,
        order_no: mismatch.order_no,
        sale_time: mismatch.created_at,
        product_id: mismatch.product_id,
        stored_cost: mismatch.stored_cost,
        expected_cost: mismatch.expected_cost,
        delta: mismatch.delta,
        matched_backdated_ledger_ids: [],
      };
      existing.matched_backdated_ledger_ids.push(entry.stock_ledger_id);
      impactedByLine.set(mismatch.line_id, existing);
    }
  }

  return [...impactedByLine.values()].sort((a, b) =>
    Math.abs(b.delta) - Math.abs(a.delta) ||
    a.line_id.localeCompare(b.line_id),
  );
}

function buildConsumedItemsByLine(
  mismatches: MacCogsLineMismatch[],
  source: {
    orderById: Map<string, OrderRow>;
    lineById: Map<string, OrderLineRow>;
    ledger: StockLedgerRow[];
    recipes: RecipeRow[];
    semiProducts: SemiProductRow[];
  },
): Map<string, Set<string>> {
  const consumptionMaps = buildSemiProductRecipeMaps(source.recipes, source.semiProducts);
  const sortedLedger = [...source.ledger].sort((a, b) =>
    timestampMs(stringValue(a.created_at)) - timestampMs(stringValue(b.created_at)),
  );
  const consumedItemsByLine = new Map<string, Set<string>>();

  for (const mismatch of mismatches) {
    const line = source.lineById.get(mismatch.line_id);
    const order = source.orderById.get(mismatch.order_id);
    if (!line || !order?.created_at) continue;

    const ledgerBeforeOrder = sortedLedger.filter(row =>
      timestampMs(stringValue(row.created_at)) <= timestampMs(order.created_at || "") &&
      stringValue(row.reference_id) !== order.id,
    );
    const balances = buildInventoryBalances(ledgerBeforeOrder, order.created_at);

    try {
      const lineRecipe = parseLineRecipeSnapshot(stringValue(line.recipe_snapshot_json) || "{}");
      applyModifierQuantitiesFromSnapshot(lineRecipe, line);
      const rows = buildLineConsumptionRows(lineRecipe, numberValue(line.qty), balances, consumptionMaps);
      consumedItemsByLine.set(
        mismatch.line_id,
        new Set(rows.map(row => row.item_reference).filter(Boolean)),
      );
    } catch {
      consumedItemsByLine.set(mismatch.line_id, new Set());
    }
  }

  return consumedItemsByLine;
}

function applyModifierQuantitiesFromSnapshot(
  lineRecipe: ReturnType<typeof parseLineRecipeSnapshot>,
  line: OrderLineRow,
): void {
  const modifierQtyById = modifierQtyByIdFromLine(line);
  for (const modifier of lineRecipe.modifiers) {
    if (!modifier.modifier_qty) {
      modifier.modifier_qty = modifierQtyById.get(modifier.modifier_id) || 1;
    }
  }
}

function modifierQtyByIdFromLine(line: OrderLineRow): Map<string, number> {
  try {
    const parsed = JSON.parse(stringValue(line.modifiers_snapshot_json) || "[]");
    if (!Array.isArray(parsed)) return new Map();
    const entries = parsed.map(modifier => {
      const row = modifier as Record<string, unknown>;
      return [stringValue(row.id), numberValue(row.qty) || 1] as const;
    });
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function buildReport(entries: BackdatedEntry[], impactLines: ImpactLine[]): AuditReport {
  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_entries: entries.length,
      precise_entries: entries.filter(entry => entry.detection_method === "SOURCE_CREATED_AT").length,
      proxy_entries: entries.filter(entry => entry.detection_method === "OLDER_THAN_ONE_DAY_PROXY").length,
      total_abs_drift_vnd: impactLines.reduce((sum, line) => sum + Math.abs(line.delta), 0),
      impacted_line_count: impactLines.length,
    },
    counts_by_month: countBy(entries, entry => entry.effective_timestamp.slice(0, 7), "month"),
    counts_by_source_table: countBy(entries, entry => entry.source_table || "(blank)", "source_table"),
    top_item_references: countBy(entries, entry => entry.item_reference || "(blank)", "item_reference")
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    entries,
    impact_lines: impactLines,
  };
}

function countBy<Key extends "month" | "source_table" | "item_reference">(
  entries: BackdatedEntry[],
  keyFn: (entry: BackdatedEntry) => string,
  keyName: Key,
): Array<Record<Key, string> & { count: number }> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = keyFn(entry);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ [keyName]: key, count }) as Record<Key, string> & { count: number });
}

function renderMarkdown(report: AuditReport): string {
  const sampleEntries = report.entries.slice(0, 5);
  const sampleImpact = report.impact_lines.slice(0, 5);

  return `# Backdated Ledger Pattern Audit

Date: 2026-07-09
Owner: Codex
Scope: Task 3.2 Phase A historical pattern audit, read-only.

## Methodology

The audit scanned stock ledger rows whose transaction type can increase inventory: PO_RECEIPT, STOCK_ADJUST, and PRODUCTION_YIELD.

PO_RECEIPT rows are precise: the script compares stock_ledger.created_at (effective timestamp) with purchase_orders.created_at (visibility timestamp) through stock_ledger.reference_id = purchase_orders.id. Rows where the ledger timestamp is earlier than the purchase order creation timestamp are treated as historical backdated receipts.

STOCK_ADJUST and PRODUCTION_YIELD lack a sibling source row with an independent creation timestamp, so the script uses a proxy: effective timestamp older than one day before audit runtime. These rows are counted separately as imprecise and should not be treated as proof of operator backdating without manual review.

VND impact is estimated from existing MAC drift replay by matching current mismatched order lines whose sale time falls between each backdated row's effective timestamp and visibility timestamp and whose replay consumption includes the backdated item_reference. This is a review-queue impact estimate, not a data write and not a recovery plan.

## Counts

- Total entries: ${report.summary.total_entries}
- Precise PO entries: ${report.summary.precise_entries}
- Proxy entries: ${report.summary.proxy_entries}
- Impacted current drift lines: ${report.summary.impacted_line_count}

### By Month

${renderTable(report.counts_by_month, ["month", "count"])}

### By Source Table

${renderTable(report.counts_by_source_table, ["source_table", "count"])}

### Top Item References

${renderTable(report.top_item_references, ["item_reference", "count"])}

## VND Impact

- Sum of absolute matched current drift: ${formatVnd(report.summary.total_abs_drift_vnd)}

## Sample

${renderTable(sampleEntries, [
    "stock_ledger_id",
    "transaction_type",
    "source_id",
    "item_reference",
    "effective_timestamp",
    "visibility_timestamp",
    "lag_minutes",
  ])}

### Sample Impact Lines

${renderTable(sampleImpact, [
    "order_no",
    "line_id",
    "sale_time",
    "product_id",
    "stored_cost",
    "expected_cost",
    "delta",
  ])}

## Coverage Gap

STOCK_ADJUST and PRODUCTION_YIELD do not currently expose a durable independent source-created timestamp in the same way purchase_orders.created_at does for PO_RECEIPT. Their historical detection is therefore proxy-only. INITIAL_BALANCE is included in the future trigger because it can increase inventory, but it is not included in this historical backfill scan because there is no precise sibling source and legacy initial balances can be intentionally old.

## Recommendation

Phase B remains appropriate if the team accepts that future trigger-captured events are the authoritative review queue and historical rows are audit-only. The recompute engine should operate on backdated_ledger_events rows created after migration 0014, while this report stays as evidence for the policy decision and review workflow sizing.

Generated artifact: \`${JSON_REPORT_PATH}\`
`;
}

function renderTable(rows: Array<Record<string, unknown>>, columns: string[]): string {
  if (rows.length === 0) return "_None._";
  const header = `| ${columns.join(" | ")} |`;
  const separator = `| ${columns.map(() => "---").join(" | ")} |`;
  const body = rows
    .map(row => `| ${columns.map(column => formatCell(row[column])).join(" | ")} |`)
    .join("\n");
  return [header, separator, body].join("\n");
}

function formatCell(value: unknown): string {
  if (typeof value === "number") return String(Math.round(value));
  return String(value ?? "").replace(/\|/g, "\\|");
}

function printSummary(report: AuditReport): void {
  console.log("=== BACKDATED LEDGER EVENT BACKFILL AUDIT (READ ONLY) ===");
  console.log(`Entries:              ${report.summary.total_entries}`);
  console.log(`Precise PO entries:   ${report.summary.precise_entries}`);
  console.log(`Proxy entries:        ${report.summary.proxy_entries}`);
  console.log(`Impacted drift lines: ${report.summary.impacted_line_count}`);
  console.log(`Abs drift estimate:   ${formatVnd(report.summary.total_abs_drift_vnd)}`);
  console.log(`JSON artifact:        ${JSON_REPORT_PATH}`);
  console.log(`Audit doc:            ${DOC_REPORT_PATH}`);
  console.log("No database rows were written.");
}

function writeJsonReport(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeTextReport(path: string, text: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text, "utf8");
}

function inferSourceTable(transactionType: string): string {
  if (transactionType === "PO_RECEIPT") return "purchase_orders";
  if (transactionType === "STOCK_ADJUST") return "stock_adjustments";
  if (transactionType === "PRODUCTION_YIELD") return "production_yields";
  return "stock_ledger";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampMs(value: string): number {
  return new Date(value || 0).getTime();
}

function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")} VND`;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
