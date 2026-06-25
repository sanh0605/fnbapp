import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Phase 4.1 — Stock ledger schema audit.
 *
 * Verifies ledger row conventions:
 *   1. transaction_type belongs to known enum.
 *   2. Quantity sign conventions:
 *      - PO_RECEIPT, ADJUSTMENT_IN, EDIT_REVERSAL (when reversing a consume), PRODUCTION_YIELD: positive
 *      - SALES_CONSUME, EDIT_CONSUME, PRODUCTION_CONSUME, ADJUSTMENT_OUT: negative
 *      - EDIT_REVERSAL sign is reversed original — so can be either (validate case-by-case).
 *   3. unit_cost is non-negative.
 *   4. reference_id is non-empty and traceable (order_id or PO id or production id).
 */

const VALID_TYPES = new Set([
  "PO_RECEIPT",
  "SALES_CONSUME",
  "EDIT_REVERSAL",
  "EDIT_CONSUME",
  "PRODUCTION_CONSUME",
  "PRODUCTION_YIELD",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "STOCK_ADJUST",
]);

const POSITIVE_TYPES = new Set([
  "PO_RECEIPT",
  "ADJUSTMENT_IN",
  "PRODUCTION_YIELD",
]);

const NEGATIVE_TYPES = new Set([
  "SALES_CONSUME",
  "EDIT_CONSUME",
  "PRODUCTION_CONSUME",
  "ADJUSTMENT_OUT",
]);

async function main() {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const ledger = await findAllNoCache("Stock_Ledger");

  let invalidType = 0;
  let signMismatch = 0;
  let negativeCost = 0;
  let missingRef = 0;
  let missingItemRef = 0;
  let missingTimestamp = 0;

  const typeCounts = new Map<string, number>();
  const signViolations = new Map<string, number>();

  for (const row of ledger as any[]) {
    const type = row.transaction_type || "";
    typeCounts.set(type, (typeCounts.get(type) || 0) + 1);

    if (!VALID_TYPES.has(type)) {
      invalidType++;
      continue;
    }

    const qty = Number(row.quantity_change || 0);
    const isZero = qty === 0;

    if (POSITIVE_TYPES.has(type) && qty < 0) {
      signMismatch++;
      signViolations.set(type, (signViolations.get(type) || 0) + 1);
    }
    if (NEGATIVE_TYPES.has(type) && qty > 0) {
      signMismatch++;
      signViolations.set(type, (signViolations.get(type) || 0) + 1);
    }

    const unitCost = Number(row.unit_cost || 0);
    if (unitCost < 0) negativeCost++;

    if (!row.reference_id) {
      // PRODUCTION_YIELD may have empty reference_id in some flows; flag everything else
      if (type !== "PRODUCTION_YIELD") missingRef++;
    }
    if (!row.item_reference) missingItemRef++;
    if (!row.created_at) missingTimestamp++;
  }

  console.log("=== STOCK LEDGER SCHEMA AUDIT ===");
  console.log(`Total ledger rows: ${(ledger as any[]).length}\n`);

  console.log("Transaction type distribution:");
  for (const [type, count] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) {
    const valid = VALID_TYPES.has(type) ? "" : " (INVALID)";
    console.log(`  ${type || "(empty)"}: ${count}${valid}`);
  }

  console.log(`\nInvalid transaction_type:        ${invalidType}`);
  console.log(`Sign convention violations:      ${signMismatch}`);
  if (signViolations.size > 0) {
    for (const [t, c] of signViolations.entries()) console.log(`  ${t}: ${c}`);
  }
  console.log(`Negative unit_cost:              ${negativeCost}`);
  console.log(`Missing reference_id:            ${missingRef}`);
  console.log(`Missing item_reference:          ${missingItemRef}`);
  console.log(`Missing created_at:              ${missingTimestamp}`);

  console.log("\nNo data was written.");
}

main().catch(err => { console.error("FATAL:", err); process.exit(1); });
