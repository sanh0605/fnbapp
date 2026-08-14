import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

// Type-only, erased at compile time -- does not run before dotenv.config()
// the way a value import from this module's siblings would.
import type { RevenueOrder, RevenueLine, RevenuePayment } from "./verify-revenue-core";

/**
 * Plan H, task H1 (docs/superpowers/plans/2026-08-14-revenue-audit.md).
 * Re-runnable revenue verification: every check in section 1, against live
 * data. Prints the figures, exits non-zero if any structural check finds a
 * violation.
 *
 * Read-only. No writes, no --apply, no migration -- this script audits.
 *
 * Run: npx vite-node scripts/verify-revenue.ts
 *
 * Gated (exit 1 on failure):
 *   - checks 1-4, zero violations required
 *   - row-count sanity (trap #1 below)
 *   - April-July monthly revenue AND order count, exact match against the
 *     frozen figures below -- these months are closed history, per the plan
 *   - overall COMPLETED order count, floor only (>= EXPECTED_ORDER_COUNT):
 *     it only grows as the shop sells, so a floor is the honest gate, not
 *     an exact match
 *
 * Printed, not gated: overall revenue total, August's monthly figures
 * (still open), check 4's own order-count/amount breakdown beyond "zero
 * violations" (grows as more sales record a payment), and the no-payment
 * bucket (section 2: permanently unverifiable, not a target to shrink).
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
  const lines: RevenueLine[] = (rawLines as any[])
    .filter(l => orderIds.has(l.order_id))
    .map(l => ({ order_id: l.order_id, net_line_total: Number(l.net_line_total) || 0 }));
  const payments: RevenuePayment[] = (rawPayments as any[])
    .filter(p => orderIds.has(p.order_id))
    .map(p => ({ order_id: p.order_id, amount: Number(p.amount) || 0 }));

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
