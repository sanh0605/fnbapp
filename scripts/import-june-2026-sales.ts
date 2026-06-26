/**
 * Import historical sales for June 2026 (Phin Di brand).
 *
 * Source: user-provided spreadsheet, 110 line items dated 2026-06-01..2026-06-26.
 * Brand: Phin Di (code "PHD"). Variants: VAR-036, VAR-037. Unit price: 5000 VND.
 * Grouping: by (date, external don, payment_method). Mixed-payment orders split.
 * 76 unique external don numbers + 1 split (don 62) = 77 planned orders.
 *
 * Pipeline: clone of app/pos/actions.ts:submitOrderV2.
 *   - buildOrderFromCart (with suppress_auto_promotion, unit_price_snapshot override)
 *   - Override created_at / completed_at to historical noon Asia/Ho_Chi_Minh
 *   - MAC COGS computed against pastLedger filtered to sale time
 *   - Stock_Ledger SALES_CONSUME rows via buildLineConsumptionRows
 *   - insertOrderV2Records for atomic per-order insert (apply mode only)
 *
 * Idempotency:
 *   - Each order tagged with migration_notes = "june-2026-import::date=...::don=...::pay=..."
 *   - Dry-run scans existing Orders_V2 for matching tags and reports skip count
 *   - Apply skips orders whose tag already exists
 *
 * Usage:
 *   node_modules\.bin\vite-node.cmd scripts/import-june-2026-sales.ts            # dry-run (default)
 *   node_modules\.bin\vite-node.cmd scripts/import-june-2026-sales.ts --apply    # write to Google Sheets
 *
 * Risk boundary: touches order creation + COGS + ledger. Codex review required before --apply.
 */

if (typeof window === "undefined") {
  process.env.TZ = "Asia/Ho_Chi_Minh";
}
process.env.CLI_MODE = "true";

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildOrderFromCart } from "../lib/order-cart";
import { computeMacCostForConsumptionRows } from "../lib/mac-cogs";
import {
  buildInventoryBalances,
  buildLineConsumptionRows,
  buildSemiProductRecipeMaps,
} from "../lib/inventory-consumption";
import { parseLineRecipeSnapshot, EVENT_TYPE } from "../lib/order-types";

// ============================================================
// Data - 110 rows from user spreadsheet (June 2026)
// Tuple: [date, external_don, variant_id, qty, payment]
// ============================================================

type Payment = "CASH" | "BANK_TRANSFER";
type Row = [string, number, string, number, Payment];

const ROWS: Row[] = [
  ["2026-06-01", 1, "VAR-036", 2, "BANK_TRANSFER"],
  ["2026-06-01", 2, "VAR-036", 6, "CASH"],
  ["2026-06-01", 2, "VAR-037", 3, "CASH"],
  ["2026-06-03", 3, "VAR-036", 2, "CASH"],
  ["2026-06-03", 4, "VAR-036", 2, "CASH"],
  ["2026-06-03", 5, "VAR-037", 3, "CASH"],
  ["2026-06-03", 6, "VAR-036", 4, "CASH"],
  ["2026-06-03", 6, "VAR-037", 4, "CASH"],
  ["2026-06-04", 7, "VAR-036", 2, "CASH"],
  ["2026-06-04", 8, "VAR-036", 1, "CASH"],
  ["2026-06-05", 9, "VAR-036", 2, "CASH"],
  ["2026-06-05", 9, "VAR-037", 1, "CASH"],
  ["2026-06-05", 10, "VAR-036", 2, "CASH"],
  ["2026-06-05", 11, "VAR-037", 2, "CASH"],
  ["2026-06-06", 12, "VAR-037", 2, "CASH"],
  ["2026-06-06", 13, "VAR-037", 2, "CASH"],
  ["2026-06-06", 14, "VAR-036", 2, "CASH"],
  ["2026-06-06", 15, "VAR-037", 5, "CASH"],
  ["2026-06-09", 16, "VAR-036", 2, "CASH"],
  ["2026-06-09", 17, "VAR-036", 2, "CASH"],
  ["2026-06-09", 18, "VAR-037", 1, "BANK_TRANSFER"],
  ["2026-06-09", 18, "VAR-036", 1, "BANK_TRANSFER"],
  ["2026-06-11", 19, "VAR-037", 2, "CASH"],
  ["2026-06-11", 19, "VAR-036", 1, "CASH"],
  ["2026-06-11", 20, "VAR-037", 1, "CASH"],
  ["2026-06-11", 20, "VAR-036", 1, "CASH"],
  ["2026-06-11", 21, "VAR-037", 1, "BANK_TRANSFER"],
  ["2026-06-11", 22, "VAR-037", 1, "CASH"],
  ["2026-06-11", 22, "VAR-036", 1, "CASH"],
  ["2026-06-12", 23, "VAR-037", 2, "CASH"],
  ["2026-06-12", 24, "VAR-037", 1, "CASH"],
  ["2026-06-12", 24, "VAR-036", 1, "CASH"],
  ["2026-06-12", 25, "VAR-037", 2, "CASH"],
  ["2026-06-12", 26, "VAR-036", 2, "BANK_TRANSFER"],
  ["2026-06-12", 26, "VAR-037", 4, "BANK_TRANSFER"],
  ["2026-06-16", 27, "VAR-036", 1, "CASH"],
  ["2026-06-16", 27, "VAR-037", 2, "CASH"],
  ["2026-06-16", 28, "VAR-036", 1, "BANK_TRANSFER"],
  ["2026-06-16", 28, "VAR-037", 2, "BANK_TRANSFER"],
  ["2026-06-16", 29, "VAR-036", 1, "CASH"],
  ["2026-06-16", 29, "VAR-037", 1, "CASH"],
  ["2026-06-16", 30, "VAR-036", 1, "CASH"],
  ["2026-06-16", 30, "VAR-037", 2, "CASH"],
  ["2026-06-16", 31, "VAR-036", 2, "CASH"],
  ["2026-06-16", 31, "VAR-037", 2, "CASH"],
  ["2026-06-17", 32, "VAR-036", 1, "CASH"],
  ["2026-06-17", 32, "VAR-037", 2, "CASH"],
  ["2026-06-17", 33, "VAR-037", 1, "BANK_TRANSFER"],
  ["2026-06-17", 34, "VAR-036", 3, "CASH"],
  ["2026-06-17", 34, "VAR-037", 2, "CASH"],
  ["2026-06-17", 35, "VAR-036", 1, "CASH"],
  ["2026-06-17", 35, "VAR-037", 1, "CASH"],
  ["2026-06-17", 36, "VAR-037", 2, "CASH"],
  ["2026-06-17", 37, "VAR-036", 1, "CASH"],
  ["2026-06-17", 37, "VAR-037", 1, "CASH"],
  ["2026-06-17", 38, "VAR-036", 2, "BANK_TRANSFER"],
  ["2026-06-17", 38, "VAR-037", 5, "BANK_TRANSFER"],
  ["2026-06-18", 39, "VAR-036", 1, "BANK_TRANSFER"],
  ["2026-06-18", 39, "VAR-037", 2, "BANK_TRANSFER"],
  ["2026-06-18", 40, "VAR-036", 1, "CASH"],
  ["2026-06-18", 41, "VAR-037", 2, "CASH"],
  ["2026-06-18", 42, "VAR-036", 1, "CASH"],
  ["2026-06-18", 42, "VAR-037", 1, "CASH"],
  ["2026-06-18", 43, "VAR-037", 3, "CASH"],
  ["2026-06-18", 44, "VAR-037", 6, "CASH"],
  ["2026-06-18", 45, "VAR-037", 2, "CASH"],
  ["2026-06-18", 46, "VAR-037", 1, "CASH"],
  ["2026-06-18", 47, "VAR-036", 2, "CASH"],
  ["2026-06-19", 48, "VAR-037", 2, "CASH"],
  ["2026-06-19", 49, "VAR-037", 2, "CASH"],
  ["2026-06-19", 50, "VAR-036", 1, "CASH"],
  ["2026-06-19", 50, "VAR-037", 1, "CASH"],
  ["2026-06-19", 51, "VAR-036", 3, "CASH"],
  ["2026-06-19", 51, "VAR-037", 2, "CASH"],
  ["2026-06-19", 52, "VAR-037", 2, "CASH"],
  ["2026-06-19", 53, "VAR-037", 1, "CASH"],
  ["2026-06-22", 54, "VAR-037", 1, "CASH"],
  ["2026-06-22", 55, "VAR-036", 1, "BANK_TRANSFER"],
  ["2026-06-22", 55, "VAR-037", 3, "BANK_TRANSFER"],
  ["2026-06-22", 56, "VAR-037", 3, "CASH"],
  ["2026-06-22", 57, "VAR-036", 1, "CASH"],
  ["2026-06-22", 58, "VAR-037", 3, "CASH"],
  ["2026-06-23", 59, "VAR-037", 1, "BANK_TRANSFER"],
  ["2026-06-23", 60, "VAR-037", 4, "BANK_TRANSFER"],
  ["2026-06-24", 61, "VAR-036", 2, "CASH"],
  ["2026-06-24", 61, "VAR-037", 1, "CASH"],
  ["2026-06-24", 62, "VAR-036", 2, "BANK_TRANSFER"],
  ["2026-06-24", 62, "VAR-037", 5, "CASH"],
  ["2026-06-24", 63, "VAR-036", 1, "CASH"],
  ["2026-06-24", 64, "VAR-036", 2, "BANK_TRANSFER"],
  ["2026-06-24", 64, "VAR-037", 2, "BANK_TRANSFER"],
  ["2026-06-24", 65, "VAR-036", 2, "BANK_TRANSFER"],
  ["2026-06-24", 65, "VAR-037", 4, "BANK_TRANSFER"],
  ["2026-06-24", 66, "VAR-037", 2, "CASH"],
  ["2026-06-24", 67, "VAR-036", 1, "CASH"],
  ["2026-06-24", 67, "VAR-037", 1, "CASH"],
  ["2026-06-25", 68, "VAR-036", 1, "CASH"],
  ["2026-06-25", 69, "VAR-036", 1, "CASH"],
  ["2026-06-25", 69, "VAR-037", 5, "CASH"],
  ["2026-06-25", 70, "VAR-036", 1, "CASH"],
  ["2026-06-25", 70, "VAR-037", 2, "CASH"],
  ["2026-06-25", 71, "VAR-037", 1, "BANK_TRANSFER"],
  ["2026-06-25", 72, "VAR-036", 1, "CASH"],
  ["2026-06-25", 72, "VAR-037", 2, "CASH"],
  ["2026-06-26", 73, "VAR-037", 1, "CASH"],
  ["2026-06-26", 74, "VAR-036", 1, "CASH"],
  ["2026-06-26", 75, "VAR-036", 1, "CASH"],
  ["2026-06-26", 75, "VAR-037", 2, "CASH"],
  ["2026-06-26", 76, "VAR-036", 1, "CASH"],
  ["2026-06-26", 76, "VAR-037", 1, "CASH"],
];

// ============================================================
// Constants
// ============================================================

const BRAND_CODE = "PHD";
const ACTOR = { id: "data-import", name: "Data Import Script" } as const;
const UNIT_PRICE_OVERRIDE = 5000;
// Random sale time window per order: 07:00:00 - 08:30:00 Asia/Ho_Chi_Minh.
// User request: each order's created_at should fall within morning opening hours.
const SALE_HOUR_START = 7;
const SALE_HOUR_END = 8;
const SALE_MINUTE_END = 30;
const IDEMPOTENCY_PREFIX = "june-2026-import::";
const PREVIEW_PATH = "docs/audits/2026-06-26-june-2026-sales-import-preview.json";

// ============================================================
// Helpers
// ============================================================

interface PlannedOrder {
  date: string;
  don: number;
  payment: Payment;
  rows: Row[];
  tag: string;
  alreadyImported: boolean;
  order?: any;
  lines?: any[];
  event?: any;
  ledgerEntries?: any[];
  orderNo?: string;
  error?: string;
}

function historicalISO(date: string): string {
  // Random time between 07:00:00 and 08:30:00 Asia/Ho_Chi_Minh
  const windowSeconds = (SALE_HOUR_END * 60 + SALE_MINUTE_END - SALE_HOUR_START * 60) * 60;
  const offset = Math.floor(Math.random() * windowSeconds);
  const totalSeconds = SALE_HOUR_START * 3600 + offset;
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return new Date(`${date}T${hh}:${mm}:${ss}+07:00`).toISOString();
}

function idempotencyTag(date: string, don: number, payment: Payment): string {
  return `${IDEMPOTENCY_PREFIX}date=${date}::don=${don}::pay=${payment}`;
}

function groupRows(rows: Row[]): PlannedOrder[] {
  const map = new Map<string, PlannedOrder>();
  for (const row of rows) {
    const [date, don, , , payment] = row;
    const tag = idempotencyTag(date, don, payment);
    if (!map.has(tag)) {
      map.set(tag, { date, don, payment, rows: [], tag, alreadyImported: false });
    }
    map.get(tag)!.rows.push(row);
  }
  return Array.from(map.values()).sort((a, b) => {
    const da = new Date(historicalISO(a.date)).getTime();
    const db = new Date(historicalISO(b.date)).getTime();
    if (da !== db) return da - db;
    if (a.don !== b.don) return a.don - b.don;
    return a.payment.localeCompare(b.payment);
  });
}

function padOrderNo(n: number): string {
  return `${BRAND_CODE}${n.toString().padStart(6, "0")}`;
}

// ============================================================
// Main
// ============================================================

async function main() {
  const applyMode = process.argv.includes("--apply");
  console.log(`=== Import June 2026 Sales ===`);
  console.log(`Mode: ${applyMode ? "APPLY (will write to Google Sheets)" : "DRY-RUN (read-only)"}`);
  console.log();

  console.log("Loading reference data...");
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { insertOrderV2Records } = await import("../lib/sheets-db-v2");
  const [
    brands, products, variants, categories, modifiers, promotions,
    recipes, baseIngredients, semiProducts, existingOrders,
  ] = await Promise.all([
    findAllNoCache("Brands"),
    findAllNoCache("Products"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Product_Categories"),
    findAllNoCache("Modifiers"),
    findAllNoCache("Promotions"),
    findAllNoCache("Recipes"),
    findAllNoCache("Base_Ingredients"),
    findAllNoCache("Semi_Products"),
    findAllNoCache("Orders_V2"),
  ]);

  // Validate brand
  const brand = (brands as any[]).find((b) => String(b.code) === BRAND_CODE);
  if (!brand) {
    console.error(`FAIL: Brand with code "${BRAND_CODE}" not found.`);
    process.exit(1);
  }
  console.log(`  Brand: ${brand.name} (code=${brand.code}, id=${brand.id})`);

  // Validate variants exist. Note: Products sheet may have brand_id missing for some
  // rows (PROD-027, PROD-028 created 2026-06-26 lack brand_id). We pass brand_id
  // explicitly via CartInput so buildOrderFromCart uses it for the order header.
  // The user has confirmed these are Phin Di (PHD) sales.
  const variantIds = ["VAR-036", "VAR-037"];
  const variantMap = new Map<string, { variant: any; product: any }>();
  for (const vid of variantIds) {
    const v = (variants as any[]).find((x) => String(x.id) === vid);
    if (!v) {
      console.error(`FAIL: Variant "${vid}" not found in Product_Variants.`);
      process.exit(1);
    }
    const product = (products as any[]).find((p) => String(p.id) === String(v.product_id));
    if (!product) {
      console.error(`FAIL: Variant "${vid}" references missing product_id=${v.product_id}.`);
      process.exit(1);
    }
    variantMap.set(vid, { variant: v, product });
    const productBrandId = String(product.brand_id || "");
    const brandNote = productBrandId === String(brand.id)
      ? "OK"
      : productBrandId
        ? `WARN: product.brand_id=${productBrandId} != PHD, but overriding via CartInput`
        : "WARN: product.brand_id missing in Products sheet, overriding via CartInput";
    console.log(
      `  ${vid}: ${product.name} / ${v.size_name} / system_price=${v.price} / override=${UNIT_PRICE_OVERRIDE} / ${brandNote}`,
    );
  }

  // Group rows
  const planned = groupRows(ROWS);
  console.log();
  console.log(`Data summary:`);
  console.log(`  Input rows: ${ROWS.length}`);
  console.log(`  Unique (date, don, payment) groups: ${planned.length}`);

  // Idempotency check
  const existingTags = new Set<string>();
  for (const o of existingOrders as any[]) {
    const notes = String(o.migration_notes || "");
    if (notes.startsWith(IDEMPOTENCY_PREFIX)) {
      existingTags.add(notes);
    }
  }
  for (const p of planned) {
    if (existingTags.has(p.tag)) p.alreadyImported = true;
  }
  const alreadyImported = planned.filter((p) => p.alreadyImported).length;
  const toProcess = planned.filter((p) => !p.alreadyImported).length;
  console.log(`  Already imported (will skip): ${alreadyImported}`);
  console.log(`  To process: ${toProcess}`);

  // Load ledger (evolving in-memory)
  console.log();
  console.log("Loading Stock_Ledger...");
  const ledger: any[] = await findAllNoCache("Stock_Ledger");
  console.log(`  Ledger rows: ${ledger.length}`);

  const consumptionMaps = buildSemiProductRecipeMaps(recipes as any[], semiProducts as any[]);

  // Compute starting order_no sequence
  let maxOrderNum = 0;
  for (const o of existingOrders as any[]) {
    const orderNo = String(o.order_no || "");
    if (!orderNo.startsWith(BRAND_CODE)) continue;
    const num = parseInt(orderNo.replace(BRAND_CODE, ""), 10);
    if (!isNaN(num) && num > maxOrderNum) maxOrderNum = num;
  }
  const usedOrderNos = new Set<string>(
    (existingOrders as any[]).map((o) => String(o.order_no || "")).filter(Boolean),
  );
  console.log(`  Current max ${BRAND_CODE} order_no: ${maxOrderNum}`);

  // Build all planned orders
  console.log();
  console.log(`Building ${toProcess} orders...`);
  let built = 0;
  let failed = 0;
  let inserted = 0;
  let insertFailed = 0;

  for (const p of planned) {
    if (p.alreadyImported) continue;
    try {
      const saleTime = historicalISO(p.date);
      const saleMs = new Date(saleTime).getTime();

      const items = p.rows.map(([, , vid, qty]) => ({
        product_id: variantMap.get(vid)!.product.id,
        variant_id: vid,
        qty,
        unit_price_snapshot: UNIT_PRICE_OVERRIDE,
        modifiers: [],
        manual_item_discount: { value: 0, type: "VND" as const },
      }));

      const builtResult = buildOrderFromCart(
        {
          brand_id: brand.id,
          items,
          payment_method: p.payment,
          suppress_auto_promotion: true,
          manual_order_discount: null,
          actor: ACTOR,
        },
        {
          brands: brands as any[],
          products: products as any[],
          variants: variants as any[],
          categories: categories as any[],
          modifiers: modifiers as any[],
          promotions: promotions as any[],
          recipes: recipes as any[],
          base_ingredients: baseIngredients as any[],
        },
      );

      // Override created_at / completed_at to historical date
      builtResult.order.created_at = saleTime;
      builtResult.order.completed_at = saleTime;

      // MAC COGS at historical sale time
      const pastLedger = ledger.filter((e) => {
        const t = new Date(e.created_at || 0).getTime();
        return t <= saleMs;
      });
      const consumptionBalances = buildInventoryBalances(pastLedger, saleTime);
      for (const line of builtResult.lines) {
        const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
        const consumptionRows = buildLineConsumptionRows(
          lineRecipe,
          line.qty,
          consumptionBalances,
          consumptionMaps,
        );
        line.cost_at_sale = computeMacCostForConsumptionRows(
          consumptionRows,
          pastLedger,
          saleTime,
          consumptionMaps,
        );
      }

      // Assign order_no
      maxOrderNum += 1;
      while (usedOrderNos.has(padOrderNo(maxOrderNum))) {
        maxOrderNum += 1;
      }
      const orderNo = padOrderNo(maxOrderNum);
      usedOrderNos.add(orderNo);

      const finalOrder = {
        ...builtResult.order,
        order_no: orderNo,
        migration_notes: p.tag,
      };

      // Event
      const event = {
        id: `evt-${crypto.randomUUID()}`,
        order_id: finalOrder.id,
        event_type: EVENT_TYPE.CREATED,
        event_at: saleTime,
        actor_id: ACTOR.id,
        actor_name: ACTOR.name,
        from_version: "" as const,
        to_version: 1,
        previous_order_id: "" as const,
        delta_json: JSON.stringify({
          line_count: builtResult.lines.length,
          gross_total: builtResult.order.gross_total,
          net_total: builtResult.order.net_total,
          backfill: true,
        }),
        reason: "June 2026 backfill",
      };

      // Stock_Ledger SALES_CONSUME entries
      const ledgerEntries: any[] = [];
      const balances = buildInventoryBalances(pastLedger, saleTime);
      for (const line of builtResult.lines) {
        const lineRecipe = parseLineRecipeSnapshot(line.recipe_snapshot_json);
        for (const r of buildLineConsumptionRows(lineRecipe, line.qty, balances, consumptionMaps)) {
          ledgerEntries.push({
            id: `stk-${crypto.randomUUID()}`,
            transaction_type: "SALES_CONSUME",
            reference_id: finalOrder.id,
            item_reference: r.item_reference,
            quantity_change: -r.quantity,
            unit_cost: 0,
            created_at: saleTime,
            order_event_id: event.id,
            cost_at_sale: 0,
            source: r.source,
          });
        }
      }

      p.order = finalOrder;
      p.lines = builtResult.lines;
      p.event = event;
      p.ledgerEntries = ledgerEntries;
      p.orderNo = orderNo;

      // Evolve in-memory ledger so later orders see this consumption in MAC
      for (const e of ledgerEntries) ledger.push(e);

      built++;

      if (applyMode) {
        const result = await insertOrderV2Records({
          order: finalOrder,
          lines: builtResult.lines,
          event,
          ledgerEntries,
        });
        if (result.success) {
          inserted++;
          if (inserted % 10 === 0) console.log(`  ...inserted ${inserted} orders`);
        } else {
          p.error = `Insert failed: ${result.error}`;
          insertFailed++;
        }
      }
    } catch (err: any) {
      p.error = err?.message || String(err);
      failed++;
    }
  }

  // ===== Summary =====
  console.log();
  console.log(`=== Summary ===`);
  console.log(`Mode: ${applyMode ? "APPLY" : "DRY-RUN"}`);
  console.log(`Built OK: ${built}`);
  console.log(`Build failed: ${failed}`);
  if (applyMode) {
    console.log(`Inserted OK: ${inserted}`);
    console.log(`Insert failed: ${insertFailed}`);
  }
  console.log(`Already imported (skipped): ${alreadyImported}`);
  console.log();

  // Totals from built orders
  let grossTotal = 0;
  let netTotal = 0;
  let cogsTotal = 0;
  let lineCount = 0;
  let ledgerCount = 0;
  const qtyByVariant = new Map<string, number>();
  const revenueByDay = new Map<string, number>();
  const revenueByPayment = new Map<string, number>();
  const cogsByVariant = new Map<string, number>();

  for (const p of planned) {
    if (p.alreadyImported || !p.order) continue;
    grossTotal += Number(p.order.gross_total) || 0;
    netTotal += Number(p.order.net_total) || 0;
    lineCount += p.lines!.length;
    ledgerCount += p.ledgerEntries!.length;
    revenueByDay.set(
      p.date,
      (revenueByDay.get(p.date) || 0) + (Number(p.order.gross_total) || 0),
    );
    revenueByPayment.set(
      p.payment,
      (revenueByPayment.get(p.payment) || 0) + (Number(p.order.gross_total) || 0),
    );
    for (const line of p.lines!) {
      cogsTotal += Number(line.cost_at_sale) || 0;
      qtyByVariant.set(
        line.variant_id,
        (qtyByVariant.get(line.variant_id) || 0) + Number(line.qty),
      );
      cogsByVariant.set(
        line.variant_id,
        (cogsByVariant.get(line.variant_id) || 0) + (Number(line.cost_at_sale) || 0),
      );
    }
  }

  console.log(`Total gross revenue: ${grossTotal.toLocaleString()} VND`);
  console.log(`Total net revenue: ${netTotal.toLocaleString()} VND`);
  console.log(`Total COGS (MAC at sale time): ${cogsTotal.toLocaleString()} VND`);
  console.log(`Gross profit: ${(netTotal - cogsTotal).toLocaleString()} VND`);
  console.log(`Total order lines: ${lineCount}`);
  console.log(`Total stock ledger entries: ${ledgerCount}`);
  console.log();
  console.log(`Qty by variant:`);
  for (const [v, q] of Array.from(qtyByVariant.entries()).sort()) {
    console.log(`  ${v}: ${q} units, COGS=${(cogsByVariant.get(v) || 0).toLocaleString()} VND`);
  }
  console.log();
  console.log(`Revenue by payment:`);
  for (const [pay, rev] of Array.from(revenueByPayment.entries()).sort()) {
    console.log(`  ${pay}: ${rev.toLocaleString()} VND`);
  }
  console.log();
  console.log(`Revenue by day:`);
  for (const [d, rev] of Array.from(revenueByDay.entries()).sort()) {
    console.log(`  ${d}: ${rev.toLocaleString()} VND`);
  }

  // Errors
  if (failed > 0 || insertFailed > 0) {
    console.log();
    console.log(`WARNING: ${failed + insertFailed} orders had errors:`);
    for (const p of planned) {
      if (p.error) {
        console.log(`  don=${p.don} (${p.date}, ${p.payment}): ${p.error}`);
      }
    }
  }

  // ===== Write preview JSON =====
  const previewOrders = planned.map((p) => {
    if (!p.order) {
      return {
        external_don: p.don,
        date: p.date,
        payment_method: p.payment,
        tag: p.tag,
        status: p.alreadyImported ? "already_imported" : p.error ? "error" : "built",
        error: p.error,
      };
    }
    return {
      external_don: p.don,
      date: p.date,
      payment_method: p.payment,
      order_no_preview: p.orderNo,
      order_id: p.order.id,
      tag: p.tag,
      status: p.alreadyImported ? "already_imported" : "built",
      line_count: p.lines!.length,
      ledger_count: p.ledgerEntries!.length,
      gross_vnd: Number(p.order.gross_total) || 0,
      net_vnd: Number(p.order.net_total) || 0,
      cogs_vnd: p.lines!.reduce((s: number, l: any) => s + (Number(l.cost_at_sale) || 0), 0),
      lines: p.lines!.map((l: any) => ({
        variant_id: l.variant_id,
        qty: Number(l.qty),
        unit_price: Number(l.unit_price),
        gross_line_total: Number(l.gross_line_total),
        cost_at_sale: Number(l.cost_at_sale),
      })),
    };
  });

  const preview = {
    generated_at: new Date().toISOString(),
    mode: applyMode ? "apply" : "dry-run",
    brand: { id: brand.id, code: brand.code, name: brand.name },
    variants: Object.fromEntries(
      Array.from(variantMap.entries()).map(([k, v]) => [
        k,
        {
          product_id: v.product.id,
          product_name: v.product.name,
          size_name: v.variant.size_name,
          system_price: Number(v.variant.price) || 0,
          override_price: UNIT_PRICE_OVERRIDE,
        },
      ]),
    ),
    totals: {
      input_rows: ROWS.length,
      planned_orders: planned.length,
      already_imported: alreadyImported,
      built_ok: built,
      build_failed: failed,
      inserted_ok: applyMode ? inserted : undefined,
      insert_failed: applyMode ? insertFailed : undefined,
      lines: lineCount,
      ledger_entries: ledgerCount,
      gross_total_vnd: grossTotal,
      net_total_vnd: netTotal,
      cogs_total_vnd: cogsTotal,
      gross_profit_vnd: netTotal - cogsTotal,
      qty_by_variant: Object.fromEntries(
        Array.from(qtyByVariant.entries()).sort(),
      ),
      cogs_by_variant: Object.fromEntries(
        Array.from(cogsByVariant.entries()).sort(),
      ),
      revenue_by_payment: Object.fromEntries(
        Array.from(revenueByPayment.entries()).sort(),
      ),
      revenue_by_day: Object.fromEntries(
        Array.from(revenueByDay.entries()).sort(),
      ),
    },
    orders: previewOrders,
  };

  const previewFullPath = path.resolve(process.cwd(), PREVIEW_PATH);
  fs.mkdirSync(path.dirname(previewFullPath), { recursive: true });
  fs.writeFileSync(previewFullPath, JSON.stringify(preview, null, 2));
  console.log();
  console.log(`Preview JSON written to: ${previewFullPath}`);

  if (!applyMode) {
    console.log();
    console.log(`DRY-RUN complete. To apply, run with --apply flag.`);
    console.log(`Codex review required before --apply per COLLABORATION.md risk-boundary rule.`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
