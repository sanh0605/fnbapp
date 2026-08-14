import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

// Type-only, erased at compile time -- does not run before dotenv.config()
// the way a value import from this module's siblings would.
import type { RevenueOrder, RevenueLine, RevenuePayment, RevenueLineDetail } from "./verify-revenue-core";

/**
 * Plan H, tasks H1 and H2 (docs/superpowers/plans/2026-08-14-revenue-audit.md).
 * Re-runnable revenue verification: every check in section 1 (H1) plus
 * line-level arithmetic (H2, section 3 first bullet), against live data.
 * Prints the figures, exits non-zero if any structural check finds a
 * violation.
 *
 * Read-only. No writes, no --apply, no migration -- this script audits.
 *
 * Run: npx vite-node scripts/verify-revenue.ts
 *
 * Gated (exit 1 on failure):
 *   - H1 checks 1-4 and H2 checks 1-4, zero violations required
 *   - row-count sanity (trap #1 below)
 *   - April-July monthly revenue AND order count, exact match against the
 *     frozen figures below -- these months are closed history, per the plan
 *   - overall COMPLETED order count, floor only (>= EXPECTED_ORDER_COUNT):
 *     it only grows as the shop sells, so a floor is the honest gate, not
 *     an exact match
 *
 * Printed, not gated: overall revenue total, August's monthly figures
 * (still open), H1 check 4's own order-count/amount breakdown beyond "zero
 * violations" (grows as more sales record a payment), the no-payment
 * bucket (section 2: permanently unverifiable, not a target to shrink),
 * and H2's empty-modifier-line count (informational, not a violation).
 *
 * H2's formula (gross_line_total = (unit_price + sum(modifier.price *
 * modifier.qty)) * qty) was derived BEFORE touching any data, from the
 * write path itself: lib/order-cart.ts's buildLine (live checkout and
 * order-edit, which reuses the same function) and lib/historical/
 * history-ops/migrate-v1-to-v2.ts's line builder (the V1->V2 migration)
 * compute it independently and agree exactly. Neither was read after
 * getting a result from live data -- both were read first.
 */

const EXPECTED_ORDER_COUNT = 2086;

type MonthCheck = {
  label: string;
  startDate: string;
  endDate: string;
  knownRevenue: number | null;
  knownOrderCount: number | null;
};

// Owner-verified 2026-08-14 measurement (plan section 1). April-July are
// closed history; August is still open and printed only.
const MONTH_CHECKS: MonthCheck[] = [
  { label: "2026-04", startDate: "2026-04-01", endDate: "2026-04-30", knownRevenue: 2_190_000, knownOrderCount: 53 },
  { label: "2026-05", startDate: "2026-05-01", endDate: "2026-05-31", knownRevenue: 7_675_000, knownOrderCount: 302 },
  { label: "2026-06", startDate: "2026-06-01", endDate: "2026-06-30", knownRevenue: 22_157_000, knownOrderCount: 793 },
  { label: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31", knownRevenue: 18_661_000, knownOrderCount: 664 },
  { label: "2026-08", startDate: "2026-08-01", endDate: "2026-08-31", knownRevenue: null, knownOrderCount: null },
];

async function main(): Promise<void> {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { formatNumber } = await import("../lib/format");
  const {
    checkHeaderArithmetic,
    checkLineSum,
    checkNoSupersededCompleted,
    checkPayments,
    computeMonthlyTotal,
    meetsMinimumOrderCount,
    checkLineGrossFormula,
    checkLineNetFormula,
    checkOrderLineSums,
    checkLineSanity,
  } = await import("./verify-revenue-core");

  const failures: string[] = [];

  console.log("Loading Orders_V2, Order_Lines_V2, Order_Payments...");
  const [rawOrders, rawLines, rawPayments] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Order_Payments"),
  ]);
  console.log(`Fetched: ${rawOrders.length} orders, ${rawLines.length} lines, ${rawPayments.length} payments.`);

  const allOrders = rawOrders as any[];
  const completedRaw = allOrders.filter(o => o.status === "COMPLETED");

  // Trap #1 (measured 2026-08-14): Supabase caps a select at 1.000 rows;
  // a naive read of orders_v2 (2.118 total rows as of that measurement)
  // silently truncates and produces a confident, wrong breakdown.
  // findAllNoCache already paginates internally (lib/sheets_db.ts), but
  // this asserts the outcome rather than trusting that silently -- a floor,
  // since the COMPLETED count only grows.
  if (!meetsMinimumOrderCount(completedRaw.length, EXPECTED_ORDER_COUNT)) {
    failures.push(
      `Row-count sanity: fetched ${completedRaw.length} COMPLETED orders, expected at least ${EXPECTED_ORDER_COUNT}. ` +
        `This is the shape of a silent 1.000-row truncation -- verify pagination before trusting anything else below.`,
    );
  }

  const orders: RevenueOrder[] = completedRaw.map(o => ({
    id: o.id,
    order_no: o.order_no,
    superseded_by: o.superseded_by || "",
    created_at: o.created_at,
    gross_total: Number(o.gross_total) || 0,
    promo_discount_total: Number(o.promo_discount_total) || 0,
    manual_item_discount_total: Number(o.manual_item_discount_total) || 0,
    manual_order_discount: Number(o.manual_order_discount) || 0,
    net_total: Number(o.net_total) || 0,
  }));

  const orderIds = new Set(orders.map(o => o.id));
  const orderNoById = new Map(orders.map(o => [o.id, o.order_no]));
  const rawCompletedLines = (rawLines as any[]).filter(l => orderIds.has(l.order_id));

  const lines: RevenueLine[] = rawCompletedLines.map(l => ({
    order_id: l.order_id,
    net_line_total: Number(l.net_line_total) || 0,
  }));
  const payments: RevenuePayment[] = (rawPayments as any[])
    .filter(p => orderIds.has(p.order_id))
    .map(p => ({ order_id: p.order_id, amount: Number(p.amount) || 0 }));

  // H2. product_snapshot_json/modifiers_snapshot_json are jsonb columns in
  // Postgres, but lib/sheets_db.ts's serializeRow (checked, not assumed --
  // it lists both under order_lines_v2's JSON_COLUMNS_BY_TABLE) converts
  // them back to JSON strings on the way out, for JSON.parse-based callers
  // like this one -- an empty/null value comes back as "", not "{}"/"[]".
  // lineIdByKey is presentation-only (grouping below), not part of any
  // check.
  const lineIdByKey = new Map<string, string>();
  const lineDetails: RevenueLineDetail[] = rawCompletedLines.map(l => {
    lineIdByKey.set(`${l.order_id}:${l.line_no}`, l.id);
    let productSnapshot: any = {};
    try {
      productSnapshot = JSON.parse(l.product_snapshot_json || "{}");
    } catch {
      // leave as {} -- product_name falls back to product_id below
    }
    let modifiers: Array<{ price: number; qty: number }> = [];
    try {
      const parsed = JSON.parse(l.modifiers_snapshot_json || "[]");
      if (Array.isArray(parsed)) {
        modifiers = parsed.map((m: any) => ({ price: Number(m.price) || 0, qty: Number(m.qty) || 0 }));
      }
    } catch {
      // leave as [] -- gross-formula check will report the real mismatch
      // this produces rather than silently treating it as correct
    }
    return {
      order_id: l.order_id,
      order_no: orderNoById.get(l.order_id) || l.order_id,
      line_no: Number(l.line_no) || 0,
      product_name: productSnapshot.name || l.product_id,
      unit_price: Number(l.unit_price) || 0,
      qty: Number(l.qty) || 0,
      modifiers,
      gross_line_total: Number(l.gross_line_total) || 0,
      promo_discount: Number(l.promo_discount) || 0,
      manual_item_discount: Number(l.manual_item_discount) || 0,
      order_discount_allocation: Number(l.order_discount_allocation) || 0,
      net_line_total: Number(l.net_line_total) || 0,
    };
  });

  // Presentation only: classify a line by its id prefix, for grouping
  // mismatches by shape rather than dumping every row (H2's own reporting
  // requirement). Not used by any check.
  function lineOrigin(orderId: string, lineNo: number): "native" | "migrated" | "reconstructed (H7)" {
    const id = lineIdByKey.get(`${orderId}:${lineNo}`) || "";
    if (id.startsWith("oln-reconstructed-")) return "reconstructed (H7)";
    if (id.startsWith("ol-migrated-")) return "migrated";
    return "native";
  }

  function groupByOrigin<T extends { order_id: string; line_no: number }>(items: T[]): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of items) {
      const key = lineOrigin(item.order_id, item.line_no);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return groups;
  }

  const totalRevenue = orders.reduce((s, o) => s + o.net_total, 0);
  console.log(`\nCOMPLETED orders: ${orders.length}, total net_total: ${formatNumber(totalRevenue)}d.`);
  console.log("(printed for the reader, not gated -- it only grows as the shop sells; see the monthly gate below)");

  // --- Check 1 ---------------------------------------------------------
  const check1 = checkHeaderArithmetic(orders);
  console.log(`\nCheck 1 (net_total == gross - promo - manual item - manual order): ${check1.length} violation(s) / ${orders.length}.`);
  for (const m of check1.slice(0, 20)) {
    console.log(`  ${m.order_no} (${m.order_id}): expected ${m.expected}, actual ${m.actual}`);
  }
  if (check1.length > 0) failures.push(`Check 1: ${check1.length} header-arithmetic violation(s).`);

  // --- Check 2 ---------------------------------------------------------
  const check2 = checkLineSum(orders, lines);
  console.log(
    `\nCheck 2 (net_total == sum(order_lines_v2.net_line_total)): ${check2.mismatches.length} violation(s) / ${check2.checkedCount}.`,
  );
  console.log(
    `  Orders with zero lines (excluded from this check, not counted as passing or failing it): ${check2.noLineOrders.length}.`,
  );
  for (const nl of check2.noLineOrders) {
    console.log(`    ${nl.order_no} (${nl.order_id}): net_total ${formatNumber(nl.net_total)}d, 0 lines.`);
  }
  console.log(
    "  CAVEAT: this check cannot see a line that was lost before the header total was computed from it -- " +
      "if every line for an order is gone but the header still reflects what was actually sold (UCK000269, plan section 3), " +
      "there is nothing left to sum, so the order lands in the zero-line bucket above, not in a violation. " +
      "Zero violations here proves that whichever lines survive sum correctly to their order's header; " +
      "it does not prove no line was ever lost.",
  );
  for (const m of check2.mismatches.slice(0, 20)) {
    console.log(`  ${m.order_no} (${m.order_id}): expected ${m.expected}, actual ${m.actual}`);
  }
  if (check2.mismatches.length > 0) failures.push(`Check 2: ${check2.mismatches.length} line-sum violation(s).`);

  // --- Check 3 ---------------------------------------------------------
  const check3 = checkNoSupersededCompleted(orders);
  console.log(`\nCheck 3 (no COMPLETED order carries superseded_by): ${check3.length} violation(s).`);
  for (const v of check3.slice(0, 20)) {
    console.log(`  ${v.order_no} (${v.order_id}): superseded_by = ${v.superseded_by}`);
  }
  if (check3.length > 0) failures.push(`Check 3: ${check3.length} COMPLETED order(s) carrying superseded_by.`);

  // --- Check 4 ---------------------------------------------------------
  const check4 = checkPayments(orders, payments);
  console.log(
    `\nCheck 4 (orders with >=1 payment row: sum(amount) == net_total): ${check4.mismatches.length} violation(s) / ${check4.ordersWithPayments}.`,
  );
  console.log(
    `  net_total sum: ${formatNumber(check4.netTotalWithPayments)}d, payment sum: ${formatNumber(check4.paymentSumTotal)}d, ` +
      `difference: ${formatNumber(check4.paymentSumTotal - check4.netTotalWithPayments)}d.`,
  );
  console.log(
    `  Orders with no payment row: ${check4.ordersWithoutPayments}, carrying ${formatNumber(check4.netTotalWithoutPayments)}d ` +
      `(order_payments begins 2026-07-19, plan section 2 -- reported, never treated as a failure).`,
  );
  for (const m of check4.mismatches.slice(0, 20)) {
    console.log(`  ${m.order_no} (${m.order_id}): expected ${m.expected}, actual ${m.actual}`);
  }
  if (check4.mismatches.length > 0) failures.push(`Check 4: ${check4.mismatches.length} payment-sum violation(s).`);

  // --- H2: line-level arithmetic -----------------------------------------
  console.log(
    "\n=== H2: line-level arithmetic (docs/superpowers/plans/2026-08-14-revenue-audit.md section 3) ===",
  );

  function reportLineMismatches<T extends { order_id: string; line_no: number; order_no: string; product_name: string }>(
    label: string,
    mismatches: T[],
    render: (m: T) => string,
  ) {
    if (mismatches.length === 0) return;
    const groups = groupByOrigin(mismatches);
    console.log(`  By origin: ${[...groups.entries()].map(([k, v]) => `${k}=${v.length}`).join(", ")}`);
    for (const [origin, group] of groups) {
      console.log(`  -- ${origin} (${group.length}) --`);
      for (const m of group.slice(0, 10)) {
        console.log(`    ${m.order_no} line ${m.line_no} (${m.product_name}): ${render(m)}`);
      }
      if (group.length > 10) console.log(`    ...and ${group.length - 10} more.`);
    }
  }

  // H2 check 1: gross_line_total formula.
  const h2Check1 = checkLineGrossFormula(lineDetails);
  console.log(
    `\nH2 check 1 (gross_line_total == (unit_price + sum(modifier.price * modifier.qty)) * qty): ` +
      `${h2Check1.mismatches.length} violation(s) / ${h2Check1.checkedCount}.`,
  );
  console.log(
    `  Lines with an empty modifier list: ${h2Check1.emptyModifierCount} / ${h2Check1.checkedCount} -- these only exercise the ` +
      `(unit_price * qty) term, never the modifier-summing term, so their passing is not evidence the modifier arithmetic is right. ` +
      `oln-reconstructed-uck000269-line1 (H7) is one of these by design (empty modifiers_snapshot_json is correct there, not a gap).`,
  );
  reportLineMismatches("h2c1", h2Check1.mismatches, m => `expected ${m.expected}, actual ${m.actual}, diff ${m.actual - m.expected}`);
  if (h2Check1.mismatches.length > 0) failures.push(`H2 check 1: ${h2Check1.mismatches.length} gross_line_total violation(s).`);

  // H2 check 2: per-line net formula.
  const h2Check2 = checkLineNetFormula(lineDetails);
  console.log(
    `\nH2 check 2 (net_line_total == gross_line_total - promo_discount - manual_item_discount - order_discount_allocation): ` +
      `${h2Check2.length} violation(s) / ${lineDetails.length}.`,
  );
  console.log("  Same formula lib/order-math.ts's assertOrderInvariants (I6) already asserts at write time -- not a new formula, the first re-check since.");
  reportLineMismatches("h2c2", h2Check2, m => `expected ${m.expected}, actual ${m.actual}, diff ${m.actual - m.expected}`);
  if (h2Check2.length > 0) failures.push(`H2 check 2: ${h2Check2.length} net_line_total violation(s).`);

  // H2 check 3: per-order column sums vs header (the check H1 could not do).
  const h2Check3 = checkOrderLineSums(orders, lineDetails);
  console.log(
    `\nH2 check 3 (per order: sum(gross_line_total/promo_discount/manual_item_discount/order_discount_allocation) == the matching header total): ` +
      `${h2Check3.length} violation(s) across ${orders.length} orders.`,
  );
  console.log(
    "  This is the check H1 could not do -- H1 only compared the single net figure, so an error that cancels between two " +
      "discount columns would have passed it. A promo_discount-column mismatch here is cross-referenced against OPEN-ITEMS 39 " +
      "before being called new: that item is about the POS preview differing from what the cart actually charges, a different " +
      "layer from whether the STORED line and header figures agree with each other, which is all this check looks at.",
  );
  if (h2Check3.length > 0) {
    const byField = new Map<string, typeof h2Check3>();
    for (const m of h2Check3) {
      const list = byField.get(m.field) ?? [];
      list.push(m);
      byField.set(m.field, list);
    }
    for (const [field, group] of byField) {
      console.log(`  -- ${field} (${group.length}) --`);
      for (const m of group.slice(0, 10)) {
        console.log(`    ${m.order_no}: expected ${m.expected}, actual ${m.actual}, diff ${m.actual - m.expected}`);
      }
      if (group.length > 10) console.log(`    ...and ${group.length - 10} more.`);
    }
    failures.push(`H2 check 3: ${h2Check3.length} order-vs-line-sum violation(s).`);
  }

  // H2 check 4: line sanity.
  const h2Check4 = checkLineSanity(lineDetails);
  console.log(`\nH2 check 4 (qty > 0 and unit_price >= 0 on every line): ${h2Check4.length} violation(s) / ${lineDetails.length}.`);
  reportLineMismatches("h2c4", h2Check4, m => m.reason);
  if (h2Check4.length > 0) failures.push(`H2 check 4: ${h2Check4.length} line-sanity violation(s).`);

  // --- Monthly table -----------------------------------------------------
  console.log("\nMonthly (Asia/Saigon):");
  for (const m of MONTH_CHECKS) {
    const result = computeMonthlyTotal(orders, m.label, m.startDate, m.endDate);
    if (m.knownRevenue === null) {
      console.log(`  ${m.label}: ${formatNumber(result.total)}d (${result.orderCount} orders) -- open month, not gated.`);
      continue;
    }
    const revenueMatches = result.total === m.knownRevenue;
    const countMatches = result.orderCount === m.knownOrderCount;
    console.log(
      `  ${m.label}: ${formatNumber(result.total)}d (${result.orderCount} orders) -- known: ${formatNumber(m.knownRevenue)}d ` +
        `(${m.knownOrderCount} orders)${revenueMatches && countMatches ? ", matches" : ", GATE MISMATCH"}`,
    );
    if (!revenueMatches) {
      failures.push(`Month ${m.label}: revenue ${formatNumber(result.total)}d does not match known ${formatNumber(m.knownRevenue)}d.`);
    }
    if (!countMatches) {
      failures.push(`Month ${m.label}: order count ${result.orderCount} does not match known ${m.knownOrderCount}.`);
    }
  }

  console.log(
    "\nNOTE (plan section 2): revenue before 2026-07-19 has no independent payment record to verify against -- " +
      "internally self-consistent at every level this script checks, never compared to money that actually arrived, " +
      "and permanently unverifiable, not verified. See docs/BUSINESS-RULES.md.",
  );

  if (failures.length > 0) {
    console.log(`\nREVENUE VERIFICATION FAILED -- ${failures.length} check(s) failed:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nAll structural checks passed. Revenue verification OK.");
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
