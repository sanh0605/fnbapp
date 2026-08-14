/**
 * Pure comparison logic for scripts/verify-revenue.ts, split out so it is
 * testable without a live Supabase client (repo's existing -core.ts
 * convention, e.g. scripts/reset-cost-at-sale-core.ts). Plan H, task H1
 * (docs/superpowers/plans/2026-08-14-revenue-audit.md).
 *
 * Every function here is a pure comparison over already-fetched rows -- no
 * I/O, no Supabase client, no dotenv. The script does the fetching and
 * prints the results these functions return.
 */

import { toSaigonUtcRange } from "@/lib/report-time";

export interface RevenueOrder {
  id: string;
  order_no: string;
  superseded_by: string;
  created_at: string;
  gross_total: number;
  promo_discount_total: number;
  manual_item_discount_total: number;
  manual_order_discount: number;
  net_total: number;
}

export interface RevenueLine {
  order_id: string;
  net_line_total: number;
}

export interface RevenuePayment {
  order_id: string;
  amount: number;
}

export interface Mismatch {
  order_no: string;
  order_id: string;
  expected: number;
  actual: number;
}

// Section 1, check 1: net_total == gross_total - promo_discount_total -
// manual_item_discount_total - manual_order_discount.
export function checkHeaderArithmetic(orders: readonly RevenueOrder[]): Mismatch[] {
  const mismatches: Mismatch[] = [];
  for (const o of orders) {
    const expected =
      o.gross_total - o.promo_discount_total - o.manual_item_discount_total - o.manual_order_discount;
    if (expected !== o.net_total) {
      mismatches.push({ order_no: o.order_no, order_id: o.id, expected, actual: o.net_total });
    }
  }
  return mismatches;
}

export interface LineSumCheckResult {
  mismatches: Mismatch[];
  checkedCount: number;
  // Orders with zero lines are not folded into mismatches or checkedCount --
  // there is nothing to sum, so the check has nothing to say about them.
  // See the caveat printed by the script: a fully-lost line set (every line
  // for an order gone, header untouched) lands here, not in mismatches, and
  // that is a real limit on what this check proves, not a bug in it.
  noLineOrders: Array<{ order_no: string; order_id: string; net_total: number }>;
}

// Section 1, check 2: net_total == sum(order_lines_v2.net_line_total) for
// that order. manual_order_discount is already inside net_line_total (found
// 2026-08-14, see the plan's section 1 correction) -- do not subtract it
// again here; this is a direct sum-of-lines comparison, nothing else.
export function checkLineSum(
  orders: readonly RevenueOrder[],
  lines: readonly RevenueLine[],
): LineSumCheckResult {
  const linesByOrder = new Map<string, RevenueLine[]>();
  for (const l of lines) {
    const list = linesByOrder.get(l.order_id) ?? [];
    list.push(l);
    linesByOrder.set(l.order_id, list);
  }

  const mismatches: Mismatch[] = [];
  const noLineOrders: LineSumCheckResult["noLineOrders"] = [];
  let checkedCount = 0;

  for (const o of orders) {
    const ls = linesByOrder.get(o.id) ?? [];
    if (ls.length === 0) {
      noLineOrders.push({ order_no: o.order_no, order_id: o.id, net_total: o.net_total });
      continue;
    }
    checkedCount++;
    const sum = ls.reduce((s, l) => s + l.net_line_total, 0);
    if (sum !== o.net_total) {
      mismatches.push({ order_no: o.order_no, order_id: o.id, expected: sum, actual: o.net_total });
    }
  }

  return { mismatches, checkedCount, noLineOrders };
}

export interface SupersededViolation {
  order_no: string;
  order_id: string;
  superseded_by: string;
}

// Section 1, check 3: no COMPLETED order carries a non-empty superseded_by.
// Section 4 of the plan: this exclusion is not in findCompletedOrders today
// -- revenue is correct by coincidence (an edited order's old version
// happens to carry SUPERSEDED status, not COMPLETED-with-superseded_by-set),
// not by construction. This check is the guard that would catch it if that
// coincidence ever stopped holding; it takes orders already filtered to
// status = COMPLETED, the same input findCompletedOrders itself produces.
export function checkNoSupersededCompleted(orders: readonly RevenueOrder[]): SupersededViolation[] {
  return orders
    .filter(o => o.superseded_by && o.superseded_by !== "")
    .map(o => ({ order_no: o.order_no, order_id: o.id, superseded_by: o.superseded_by }));
}

export interface PaymentCheckResult {
  mismatches: Mismatch[];
  ordersWithPayments: number;
  netTotalWithPayments: number;
  paymentSumTotal: number;
  ordersWithoutPayments: number;
  netTotalWithoutPayments: number;
}

// Section 1, check 4: for orders having at least one order_payments row,
// sum(amount) == net_total. Orders with zero payment rows are reported
// separately (ordersWithoutPayments / netTotalWithoutPayments), never as
// mismatches -- order_payments begins 2026-07-19 (section 2), so most of
// this bucket is orders that predate the feature, not a data problem.
export function checkPayments(
  orders: readonly RevenueOrder[],
  payments: readonly RevenuePayment[],
): PaymentCheckResult {
  const paymentsByOrder = new Map<string, RevenuePayment[]>();
  for (const p of payments) {
    const list = paymentsByOrder.get(p.order_id) ?? [];
    list.push(p);
    paymentsByOrder.set(p.order_id, list);
  }

  const mismatches: Mismatch[] = [];
  let ordersWithPayments = 0;
  let netTotalWithPayments = 0;
  let paymentSumTotal = 0;
  let ordersWithoutPayments = 0;
  let netTotalWithoutPayments = 0;

  for (const o of orders) {
    const ps = paymentsByOrder.get(o.id) ?? [];
    if (ps.length === 0) {
      ordersWithoutPayments++;
      netTotalWithoutPayments += o.net_total;
      continue;
    }
    ordersWithPayments++;
    netTotalWithPayments += o.net_total;
    const sum = ps.reduce((s, p) => s + p.amount, 0);
    paymentSumTotal += sum;
    if (sum !== o.net_total) {
      mismatches.push({ order_no: o.order_no, order_id: o.id, expected: sum, actual: o.net_total });
    }
  }

  return {
    mismatches,
    ordersWithPayments,
    netTotalWithPayments,
    paymentSumTotal,
    ordersWithoutPayments,
    netTotalWithoutPayments,
  };
}

export interface MonthlyTotal {
  label: string;
  total: number;
  orderCount: number;
}

// Section 1's per-month table, Asia/Saigon boundaries -- same helper
// app/admin/reports/actions.ts uses for its own date filters, no hand-rolled
// timezone arithmetic.
export function computeMonthlyTotal(
  orders: readonly RevenueOrder[],
  label: string,
  startDate: string,
  endDate: string,
): MonthlyTotal {
  const range = toSaigonUtcRange(startDate, endDate)!;
  let total = 0;
  let orderCount = 0;
  for (const o of orders) {
    const d = new Date(o.created_at);
    if (d >= range.startUtc && d <= range.endUtc) {
      total += o.net_total;
      orderCount++;
    }
  }
  return { label, total, orderCount };
}

// Trap #1 (measured 2026-08-14): Supabase caps a select at 1000 rows; a
// naive read of orders_v2 (2.118 rows) silently truncates to the first
// 1.000 and produces a confident, wrong breakdown. A floor, not an exact
// match -- the completed-order count only grows over time.
export function meetsMinimumOrderCount(actualCount: number, expectedMinimum: number): boolean {
  return actualCount >= expectedMinimum;
}
