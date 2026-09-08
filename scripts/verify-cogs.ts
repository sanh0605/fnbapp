import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

import type { PurchaseOrderHeader, PurchaseOrderLineRow } from "./verify-cogs-core";

/**
 * docs/superpowers/plans/2026-09-07-verify-cogs.md.
 * Re-runnable cost-of-goods verification, closing the gap
 * lib/costing/CLAUDE.md records in its own words: "Chưa có script `verify-*`
 * cho giá vốn." Two hard gates; a third figure (the MANUAL/STOCKTAKE split)
 * is printed, never gated -- see that section below for why.
 *
 * Read-only. No writes, no --apply, no migration.
 *
 * Run: npx vite-node scripts/verify-cogs.ts
 *
 * Gated (exit 1 on failure):
 *   Gate 1 -- every COMPLETED purchase order's lines, plus shipping and tax,
 *     minus voucher and discount, equal total_amount; subtotal_amount equals
 *     the sum of its own lines; no order has zero lines.
 *   Gate 2 -- getPnLDataV2's totalCOGS equals an independent recomputation,
 *     built in verify-cogs-core.ts from raw rows without importing
 *     lib/costing, to the đồng.
 *
 * Printed, never gated:
 *   The MANUAL/STOCKTAKE split of Gate 2's total. This script found the
 *   BR-COGS-007 gap while being written (totalCOGS combining both with no
 *   separate shrinkage line) -- that gap is closed as of 2026-09-08
 *   (docs/superpowers/plans/2026-09-08-tach-gia-von-va-hao-hut.md):
 *   getPnLDataV2 now also returns shrinkageValue and manualIssueSlipCount.
 *   totalCOGS itself still means Giá vốn + Hao hụt combined, on purpose --
 *   Gate 2 compares it against this script's own combined recomputation,
 *   so it must never be built to exclude shrinkage.
 */

function fmt(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

async function main(): Promise<void> {
  const { findAllNoCache } = await import("@/lib/db/tables");
  const { getPnLDataV2 } = await import("@/app/admin/reports/actions");
  // Not a lib/costing import (the independence Gate 2 requires) -- this is
  // the owner's fixed display-rounding rule (round cost UP, never flatter),
  // applied identically to both sides so the comparison is against what
  // getPnLDataV2 actually returns (already rounded by this same function),
  // not against an unrounded raw sum.
  const { displayMoney } = await import("@/lib/reports/display-rounding");
  const {
    checkPurchaseOrderReconciliation,
    buildChallengerPurchases,
    buildChallengerIssues,
    computeWeightedAverageIssuedValue,
    splitIssuedValueBySource,
  } = await import("./verify-cogs-core");

  console.log("Loading Purchase_Orders, Purchase_Order_Lines, Stock_Issues, stocktake_sessions, stocktake_lines, Purchased_Items, Item_Categories...");
  const [rawOrders, rawLines, rawIssues, sessions, sessionLines, purchasedItems, itemCategories] = await Promise.all([
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Stock_Issues"),
    findAllNoCache("stocktake_sessions"),
    findAllNoCache("stocktake_lines"),
    findAllNoCache("Purchased_Items"),
    findAllNoCache("Item_Categories"),
  ]);
  console.log(
    `Fetched: ${rawOrders.length} purchase orders, ${rawLines.length} lines, ${rawIssues.length} stock issues, ` +
    `${sessions.length} stocktake sessions, ${sessionLines.length} stocktake lines, ${purchasedItems.length} purchased items.`,
  );

  const nameById = new Map<string, string>(purchasedItems.map((i: any) => [i.id, i.name]));
  const itemName = (id: string) => nameById.get(id) ?? id;

  const failures: string[] = [];

  const orders: PurchaseOrderHeader[] = rawOrders.map((o: any) => ({
    id: o.id,
    subtotal_amount: Number(o.subtotal_amount) || 0,
    shipping_fee: Number(o.shipping_fee) || 0,
    tax_amount: Number(o.tax_amount) || 0,
    voucher_amount: Number(o.voucher_amount) || 0,
    discount_amount: Number(o.discount_amount) || 0,
    total_amount: Number(o.total_amount) || 0,
  }));
  const lines: PurchaseOrderLineRow[] = rawLines.map((l: any) => ({
    purchase_order_id: l.purchase_order_id,
    subtotal: Number(l.subtotal) || 0,
  }));

  // ==========================================================================
  // Gate 1: every purchase order reconciles to what was paid
  // ==========================================================================
  const gate1 = checkPurchaseOrderReconciliation(orders, lines);
  console.log(
    `\nGate 1 (purchase order reconciles to total_amount): ${gate1.reconciliationMismatches.length} mismatch(es) / ${gate1.orderCount} orders, ` +
    `${gate1.lineCount} lines, ${gate1.ordersWithNoLines.length} order(s) with no line.`,
  );
  console.log(`  Sum of line subtotals: ${fmt(gate1.sumLineSubtotals)}d. Sum paid (total_amount): ${fmt(gate1.sumPaid)}d. Gap: ${fmt(gate1.sumLineSubtotals - gate1.sumPaid)}d (shipping + tax - voucher - discount, reconciling per order above).`);
  if (gate1.reconciliationMismatches.length > 0) {
    for (const m of gate1.reconciliationMismatches) {
      console.log(`    MISMATCH ${m.order_id}: lines+adjustments = ${fmt(m.reconciled)}d vs total_amount = ${fmt(m.total_amount)}d`);
    }
    failures.push(`Gate 1: ${gate1.reconciliationMismatches.length} purchase order(s) do not reconcile to total_amount`);
  }
  if (gate1.subtotalMismatches.length > 0) {
    for (const m of gate1.subtotalMismatches) {
      console.log(`    SUBTOTAL MISMATCH ${m.order_id}: subtotal_amount = ${fmt(m.subtotal_amount)}d vs sum(lines) = ${fmt(m.lineSubtotalSum)}d`);
    }
    failures.push(`Gate 1: ${gate1.subtotalMismatches.length} purchase order(s) have subtotal_amount != sum(lines)`);
  }
  if (gate1.ordersWithNoLines.length > 0) {
    console.log(`    NO LINES: ${gate1.ordersWithNoLines.join(", ")}`);
    failures.push(`Gate 1: ${gate1.ordersWithNoLines.length} purchase order(s) have zero lines`);
  }

  // ==========================================================================
  // Gate 2: the report's cost equals an independent recomputation
  // ==========================================================================
  const challengerPurchases = buildChallengerPurchases(
    rawOrders.map((o: any) => ({
      id: o.id,
      subtotal_amount: Number(o.subtotal_amount) || 0,
      shipping_fee: Number(o.shipping_fee) || 0,
      tax_amount: Number(o.tax_amount) || 0,
      voucher_amount: Number(o.voucher_amount) || 0,
      discount_amount: Number(o.discount_amount) || 0,
      total_amount: Number(o.total_amount) || 0,
      status: o.status,
      transaction_date: o.transaction_date,
      created_at: o.created_at,
    })),
    rawLines.map((l: any) => ({ purchase_order_id: l.purchase_order_id, subtotal: Number(l.subtotal) || 0, id: l.id, purchased_item_id: l.purchased_item_id, base_quantity: Number(l.base_quantity) || 0 })),
  );
  const challengerIssues = buildChallengerIssues(
    rawIssues.map((i: any) => ({ purchased_item_id: i.purchased_item_id, issued_at: i.issued_at, base_quantity: Number(i.base_quantity) || 0, source: i.source })),
    purchasedItems as any[],
    itemCategories as any[],
  );

  let gate2Passed = false;
  let challengerResult: ReturnType<typeof computeWeightedAverageIssuedValue> | null = null;
  let referenceTotalCOGS: number | null = null;
  try {
    challengerResult = computeWeightedAverageIssuedValue(challengerPurchases, challengerIssues);
    const pnl = await getPnLDataV2({});
    referenceTotalCOGS = pnl.totalCOGS;
    const challengerRounded = displayMoney(challengerResult.total);

    console.log(`\nGate 2 (report's totalCOGS equals an independent recomputation): reported = ${fmt(referenceTotalCOGS)}d, recomputed = ${fmt(challengerRounded)}d.`);
    if (referenceTotalCOGS === challengerRounded) {
      gate2Passed = true;
    } else {
      failures.push(`Gate 2: reported totalCOGS (${fmt(referenceTotalCOGS)}d) does not match the independent recomputation (${fmt(challengerRounded)}d)`);
      // Which is wrong, per item -- disagreement says one side is broken,
      // not which side, so print enough to localise it.
      const byItem = new Map<string, number>();
      for (const e of challengerResult.byEvent) {
        byItem.set(e.purchased_item_id, (byItem.get(e.purchased_item_id) ?? 0) + e.value);
      }
      console.log("  Recomputed value by purchased item (for localising the disagreement):");
      for (const [id, value] of [...byItem.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`    ${itemName(id)}: ${fmt(value)}d`);
      }
    }
  } catch (e: any) {
    failures.push(`Gate 2: the independent recomputation could not complete -- ${e.message}`);
    console.log(`\nGate 2: FAILED TO COMPUTE -- ${e.message}`);
  }

  // ==========================================================================
  // Printed, never gated: the MANUAL/STOCKTAKE split, and the BR-COGS-007 gap
  // ==========================================================================
  if (challengerResult) {
    const split = splitIssuedValueBySource(challengerIssues, challengerResult.byEvent);
    console.log(
      `\nManual issues (Giá vốn per BR-COGS-007): ${fmt(split.manualValue)}d across ${split.manualCount} row(s).`,
    );
    console.log(
      `Stocktake variance (shrinkage): ${fmt(split.stocktakeValue)}d across ${split.stocktakeCount} row(s), from ${sessions.length} stocktake session(s) -- ` +
      `a figure resting on ${sessions.length} count(s) is thin; not a trend.`,
    );
    if (split.stocktakeValue !== 0) {
      const pct = split.totalValue !== 0 ? (split.stocktakeValue / split.totalValue) * 100 : 0;
      console.log(
        `\nNOTE (not a failure): totalCOGS above is Giá vốn + Hao hụt combined, by design -- ` +
        `${fmt(split.stocktakeValue)}d (${pct.toFixed(1)}% of it) is stocktake variance. BR-COGS-007's split shipped ` +
        `2026-09-08 (docs/superpowers/plans/2026-09-08-tach-gia-von-va-hao-hut.md): getPnLDataV2 now also returns ` +
        `shrinkageValue and manualIssueSlipCount, computed by a tagged single-replay split ` +
        `(computePeriodIssuedValueSplit in lib/costing/issue-costing.ts), not by re-reading Issue.source in the ` +
        `original engine, which still ignores it. No screen reads those two fields yet -- there is no P&L page ` +
        `(folded into the future financial-reports work, owner decision 2026-09-08); this script does not gate them.`,
      );
    }
  }

  console.log(
    "\nNOT CHECKED by this script: whether a purchase was entered at the wrong price, or whether an issue slip was ever " +
    "missed entirely -- both gates are internal, comparing recorded data against itself. June and July 2026 closed with no " +
    "stock count, so BR-COGS-005 cannot produce a cost figure for them at all; that is a stated exclusion from any period " +
    "report reading this data, not a zero.",
  );

  if (failures.length > 0) {
    console.log(`\nVERIFY-COGS FAILED -- ${failures.length} check(s) failed:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
    return;
  }
  if (!gate2Passed) {
    process.exitCode = 1;
    return;
  }
  console.log("\nAll gates passed. Cost verification OK.");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
