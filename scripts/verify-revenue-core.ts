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

// ============================================================================
// Plan H, task H2 -- line-level arithmetic. Extends H1 (which only compared
// net totals) down one layer: a line's own gross figure, and the four
// per-order sums H1 never separated out.
// ============================================================================

export interface RevenueLineDetail {
  order_id: string;
  order_no: string;
  line_no: number;
  product_name: string;
  variant_id: string;
  unit_price: number;
  qty: number;
  modifiers: Array<{ price: number; qty: number }>;
  gross_line_total: number;
  promo_discount: number;
  manual_item_discount: number;
  order_discount_allocation: number;
  net_line_total: number;
}

export interface LineMismatch {
  order_no: string;
  order_id: string;
  line_no: number;
  product_name: string;
  expected: number;
  actual: number;
}

export interface GrossFormulaCheckResult {
  mismatches: LineMismatch[];
  checkedCount: number;
  // Lines with an empty modifier list only exercise the (unit_price * qty)
  // term -- they cannot fail on a modifier-summing bug even if one exists.
  // Reported separately so a clean result is not read as stronger evidence
  // than it is; oln-reconstructed-uck000269-line1 (H7) is one of these by
  // design (see the script's own note at the point it prints this).
  emptyModifierCount: number;
}

// Check 1: gross_line_total == (unit_price + sum(modifier.price *
// modifier.qty)) * qty. Derived from the write path BEFORE testing against
// any data -- lib/order-cart.ts's buildLine (the live checkout and order-
// edit path, both call the same function) and lib/historical/history-ops/
// migrate-v1-to-v2.ts's line builder (the V1->V2 migration path) compute
// this formula independently of each other and agree on it exactly. Neither
// was consulted to build this check after the fact; both were read before
// writing it. Not enforced by lib/order-math.ts's assertOrderInvariants --
// that function takes gross_line_total as given and checks relationships
// between already-computed columns, never its own derivation from
// unit_price/qty/modifiers. This is the one layer nothing else checks.
export function checkLineGrossFormula(lines: readonly RevenueLineDetail[]): GrossFormulaCheckResult {
  const mismatches: LineMismatch[] = [];
  let emptyModifierCount = 0;
  for (const l of lines) {
    if (l.modifiers.length === 0) emptyModifierCount++;
    const modifiersTotal = l.modifiers.reduce((s, m) => s + m.price * m.qty, 0);
    const expected = (l.unit_price + modifiersTotal) * l.qty;
    if (expected !== l.gross_line_total) {
      mismatches.push({
        order_no: l.order_no,
        order_id: l.order_id,
        line_no: l.line_no,
        product_name: l.product_name,
        expected,
        actual: l.gross_line_total,
      });
    }
  }
  return { mismatches, checkedCount: lines.length, emptyModifierCount };
}

// Check 2: net_line_total == gross_line_total - promo_discount -
// manual_item_discount - order_discount_allocation. Same formula
// lib/order-math.ts's assertOrderInvariants (I6) already asserts at write
// time for every order built through buildOrderFromCart or the V1->V2
// migration -- this is the first time anyone has actually looked again
// after the fact, not a new formula.
export function checkLineNetFormula(lines: readonly RevenueLineDetail[]): LineMismatch[] {
  const mismatches: LineMismatch[] = [];
  for (const l of lines) {
    const expected = l.gross_line_total - l.promo_discount - l.manual_item_discount - l.order_discount_allocation;
    if (expected !== l.net_line_total) {
      mismatches.push({
        order_no: l.order_no,
        order_id: l.order_id,
        line_no: l.line_no,
        product_name: l.product_name,
        expected,
        actual: l.net_line_total,
      });
    }
  }
  return mismatches;
}

export interface OrderSumMismatch {
  order_no: string;
  order_id: string;
  field: "gross_total" | "promo_discount_total" | "manual_item_discount_total" | "manual_order_discount";
  expected: number;
  actual: number;
}

// Check 3: per order, four line-column sums against the four header totals
// they are each defined to equal. This is the check H1 could not do -- H1
// only compared the single net figure, so an error that cancels between two
// discount columns (e.g. promo_discount too high by X, manual_item_discount
// too low by the same X) would pass H1's net-total check and will not pass
// this one. Confirmed from the write path, not assumed: promo_discount_total
// is built as builtLines.reduce(sum + line.promo_discount, 0)
// (lib/order-cart.ts) with no independent order-level contribution -- a
// line's promo_discount and the header's promo_discount_total are defined
// to be the same thing (a sum relationship), not two figures that may
// legitimately diverge. Orders with zero lines are skipped (nothing to
// sum), same convention as checkLineSum.
export function checkOrderLineSums(
  orders: readonly RevenueOrder[],
  lines: readonly RevenueLineDetail[],
): OrderSumMismatch[] {
  const linesByOrder = new Map<string, RevenueLineDetail[]>();
  for (const l of lines) {
    const list = linesByOrder.get(l.order_id) ?? [];
    list.push(l);
    linesByOrder.set(l.order_id, list);
  }

  const mismatches: OrderSumMismatch[] = [];
  for (const o of orders) {
    const ls = linesByOrder.get(o.id) ?? [];
    if (ls.length === 0) continue;

    const sums = {
      gross_total: ls.reduce((s, l) => s + l.gross_line_total, 0),
      promo_discount_total: ls.reduce((s, l) => s + l.promo_discount, 0),
      manual_item_discount_total: ls.reduce((s, l) => s + l.manual_item_discount, 0),
      manual_order_discount: ls.reduce((s, l) => s + l.order_discount_allocation, 0),
    } as const;

    for (const field of Object.keys(sums) as Array<keyof typeof sums>) {
      if (sums[field] !== o[field]) {
        mismatches.push({ order_no: o.order_no, order_id: o.id, field, expected: sums[field], actual: o[field] });
      }
    }
  }
  return mismatches;
}

export interface LineSanityViolation {
  order_no: string;
  order_id: string;
  line_no: number;
  product_name: string;
  qty: number;
  unit_price: number;
  reason: string;
}

// Check 4: qty > 0 and unit_price >= 0 on every line.
export function checkLineSanity(lines: readonly RevenueLineDetail[]): LineSanityViolation[] {
  const violations: LineSanityViolation[] = [];
  for (const l of lines) {
    if (!(l.qty > 0)) {
      violations.push({
        order_no: l.order_no,
        order_id: l.order_id,
        line_no: l.line_no,
        product_name: l.product_name,
        qty: l.qty,
        unit_price: l.unit_price,
        reason: `qty ${l.qty} is not > 0`,
      });
    }
    if (!(l.unit_price >= 0)) {
      violations.push({
        order_no: l.order_no,
        order_id: l.order_id,
        line_no: l.line_no,
        product_name: l.product_name,
        qty: l.qty,
        unit_price: l.unit_price,
        reason: `unit_price ${l.unit_price} is not >= 0`,
      });
    }
  }
  return violations;
}

// ============================================================================
// Plan H, task H3 -- promotion discount recomputation. What this section
// CANNOT do: OPEN-ITEMS 39 says the POS previews a promo price with one
// calculation and charges with another; only the charged figure was ever
// written down, so nothing here confirms or refutes what the cashier saw --
// that data does not exist to recover. This section only checks whether the
// CHARGED discount agrees with the terms of the promotion recorded on the
// order at the time.
//
// The three discount_type formulas are derived from lib/order-cart.ts's
// computePromoForLine (the function that actually decided what got charged),
// not from data and not reverse-engineered after the fact:
//   FLAT_PRICE: perUnitDiscount = max(0, unit_price - targetPrice);
//     discount = min(gross_line_total, perUnitDiscount * qty).
//     Applies to the variant's own price only -- modifiers are untouched.
//   PERCENT: discount = min(gross_line_total, round(gross_line_total *
//     discount_value / 100)). Applies to the WHOLE line gross, variant AND
//     modifiers together -- the one case where modifiers are discounted too.
//   FLAT_VND (the type system's name for the third, unnamed-in-code branch):
//     discount = min(gross_line_total, discount_value * qty). Per unit, but
//     unlike FLAT_PRICE it ignores any per-variant map override entirely and
//     always uses the promotion's own top-level discount_value.
// targetPrice = applicable.get(variant_id) || discount_value -- note this is
// production's own `||`, not `??`: a real per-variant override of exactly 0
// would silently fall through to discount_value. Reproduced here exactly as
// written (matching what actually charged), not fixed. Never observed
// triggering in live data -- neither PRM-003 nor PRM-004's map has a 0
// override -- so this is a latent quirk to know about, not an active one.

export interface PromoSnapshotParsed {
  id: string;
  discountType: string;
  discountValue: number;
  applicable: Map<string, number>;
  startDate: string;
  endDate: string;
  // null when the snapshot shape does not carry this field at all -- native
  // V2 orders (built via lib/order-snapshot.ts's buildPromotionSnapshot)
  // never captured min_order_value. Migrated (V1-origin) orders copied V1's
  // own snapshot verbatim, which does carry it (as a string). Two real
  // snapshot shapes exist in live data, confirmed by reading actual rows,
  // not assumed: migrated snapshots additionally carry brand_id, created_at,
  // min_order_value, status, and discount_value/min_order_value as strings;
  // native snapshots carry exactly {id, name, type, discount_type,
  // discount_value (number), applicable_products_json, code, start_date,
  // end_date}, nothing more.
  minOrderValue: number | null;
}

// Accepts the ALREADY JSON.parsed outer applied_promotion_snapshot_json
// value (or null/undefined/{} for a missing one -- the script does the
// outer JSON.parse, matching how it already handles product_snapshot_json
// in H2, since lib/sheets_db.ts's serializeRow hands these back as strings).
// Returns null only when the snapshot itself is absent -- an order in that
// state is unrecomputable, reported separately, never silently skipped.
// A malformed inner applicable_products_json does NOT return null here --
// it degrades to an empty map, deliberately mirroring lib/order-cart.ts's
// own parseApplicable, which is exactly as lenient. Recomputing with a
// STRICTER parser than the one that actually ran would manufacture
// mismatches that never really happened.
export function parsePromotionSnapshot(raw: unknown): PromoSnapshotParsed | null {
  if (!raw || typeof raw !== "object" || Object.keys(raw as object).length === 0) return null;
  const r = raw as Record<string, unknown>;

  const applicable = new Map<string, number>();
  try {
    const parsedApplicable = JSON.parse(String(r.applicable_products_json || ""));
    if (Array.isArray(parsedApplicable)) {
      for (const v of parsedApplicable) applicable.set(String(v), 0);
    } else if (parsedApplicable && typeof parsedApplicable === "object") {
      for (const [k, v] of Object.entries(parsedApplicable)) applicable.set(k, Number(v));
    }
  } catch {
    // malformed -- empty map, matching parseApplicable's own leniency
  }

  return {
    id: String(r.id || ""),
    discountType: String(r.discount_type || ""),
    discountValue: Number(r.discount_value) || 0,
    applicable,
    startDate: String(r.start_date || ""),
    endDate: String(r.end_date || ""),
    minOrderValue:
      r.min_order_value !== undefined && r.min_order_value !== null && r.min_order_value !== ""
        ? Number(r.min_order_value)
        : null,
  };
}

// The charging formula itself -- see the section header comment above for
// the derivation and the three formulas.
export function computeExpectedPromoDiscountForLine(
  snapshot: PromoSnapshotParsed,
  variantId: string,
  unitPrice: number,
  qty: number,
  grossLineTotal: number,
): number {
  if (!snapshot.applicable.has(variantId)) return 0;
  const override = snapshot.applicable.get(variantId)!;
  const targetPrice = override || snapshot.discountValue;

  if (snapshot.discountType === "FLAT_PRICE") {
    const perUnitDiscount = Math.max(0, unitPrice - targetPrice);
    return Math.min(grossLineTotal, perUnitDiscount * qty);
  }
  if (snapshot.discountType === "PERCENT") {
    return Math.min(grossLineTotal, Math.round(grossLineTotal * (snapshot.discountValue / 100)));
  }
  return Math.min(grossLineTotal, snapshot.discountValue * qty);
}

export interface RevenuePromoOrder {
  order_id: string;
  order_no: string;
  created_at: string;
  gross_total: number;
  applied_promotion_id: string;
  promo_discount_total: number;
  snapshot: PromoSnapshotParsed | null;
}

export interface RevenuePromoLine {
  order_id: string;
  order_no: string;
  line_no: number;
  product_name: string;
  variant_id: string;
  unit_price: number;
  qty: number;
  gross_line_total: number;
  promo_discount: number;
}

export interface UnrecomputableOrder {
  order_no: string;
  order_id: string;
  reason: string;
}

export interface PromoRecomputationResult {
  lineMismatches: LineMismatch[];
  orderMismatches: Mismatch[];
  recomputedOrderCount: number;
  unrecomputable: UnrecomputableOrder[];
}

// Check 1 (plan section 5 H3): recompute from the snapshot, compare against
// both the header's promo_discount_total and each line's own promo_discount.
// Only orders with applied_promotion_id set are considered here -- the
// no-promo-but-discount-present asymmetric case is checkPromoAsymmetry's
// job, not this function's, since there is no snapshot to recompute from in
// that case either way.
export function checkPromoRecomputation(
  orders: readonly RevenuePromoOrder[],
  linesByOrderId: ReadonlyMap<string, readonly RevenuePromoLine[]>,
): PromoRecomputationResult {
  const lineMismatches: LineMismatch[] = [];
  const orderMismatches: Mismatch[] = [];
  const unrecomputable: UnrecomputableOrder[] = [];
  let recomputedOrderCount = 0;

  for (const o of orders) {
    if (!o.applied_promotion_id) continue;

    if (!o.snapshot) {
      unrecomputable.push({
        order_no: o.order_no,
        order_id: o.order_id,
        reason: "applied_promotion_id set but applied_promotion_snapshot_json is empty",
      });
      continue;
    }

    recomputedOrderCount++;
    const ls = linesByOrderId.get(o.order_id) ?? [];
    let expectedOrderTotal = 0;
    for (const l of ls) {
      const expected = computeExpectedPromoDiscountForLine(o.snapshot, l.variant_id, l.unit_price, l.qty, l.gross_line_total);
      expectedOrderTotal += expected;
      if (expected !== l.promo_discount) {
        lineMismatches.push({
          order_no: l.order_no,
          order_id: l.order_id,
          line_no: l.line_no,
          product_name: l.product_name,
          expected,
          actual: l.promo_discount,
        });
      }
    }
    if (expectedOrderTotal !== o.promo_discount_total) {
      orderMismatches.push({ order_no: o.order_no, order_id: o.order_id, expected: expectedOrderTotal, actual: o.promo_discount_total });
    }
  }

  return { lineMismatches, orderMismatches, recomputedOrderCount, unrecomputable };
}

export interface PromoEligibilityViolation {
  order_no: string;
  order_id: string;
  reason: string;
}

// Check 2: was the promotion eligible at all at that moment -- order date
// inside the snapshot's window, min_order_value satisfied (only where the
// snapshot shape carries that field -- see PromoSnapshotParsed's comment),
// and (separately, checkLineVariantCoverage below) the variant actually
// covered.
export function checkPromoEligibility(orders: readonly RevenuePromoOrder[]): PromoEligibilityViolation[] {
  const violations: PromoEligibilityViolation[] = [];
  for (const o of orders) {
    if (!o.snapshot) continue; // unrecomputable, reported separately

    const orderDate = new Date(o.created_at).getTime();
    const start = o.snapshot.startDate ? new Date(o.snapshot.startDate).getTime() : NaN;
    const end = o.snapshot.endDate ? new Date(o.snapshot.endDate).getTime() : NaN;

    if (!Number.isNaN(start) && orderDate < start) {
      violations.push({
        order_no: o.order_no,
        order_id: o.order_id,
        reason: `order date (${o.created_at}) is before the promotion's own start_date (${o.snapshot.startDate})`,
      });
    }
    if (!Number.isNaN(end) && orderDate > end) {
      violations.push({
        order_no: o.order_no,
        order_id: o.order_id,
        reason: `order date (${o.created_at}) is after the promotion's own end_date (${o.snapshot.endDate})`,
      });
    }
    if (o.snapshot.minOrderValue !== null && o.gross_total < o.snapshot.minOrderValue) {
      violations.push({
        order_no: o.order_no,
        order_id: o.order_id,
        reason: `gross_total (${o.gross_total}) is below the snapshot's own min_order_value (${o.snapshot.minOrderValue})`,
      });
    }
  }
  return violations;
}

export interface LineCoverageViolation {
  order_no: string;
  order_id: string;
  line_no: number;
  product_name: string;
  variant_id: string;
  promo_discount: number;
}

// Check 4: any line carrying promo_discount whose variant the applied
// promotion does not cover.
export function checkLineVariantCoverage(
  orders: readonly RevenuePromoOrder[],
  lines: readonly RevenuePromoLine[],
): LineCoverageViolation[] {
  const snapshotByOrderId = new Map(orders.map(o => [o.order_id, o.snapshot]));
  const violations: LineCoverageViolation[] = [];
  for (const l of lines) {
    if (l.promo_discount <= 0) continue;
    const snapshot = snapshotByOrderId.get(l.order_id);
    if (!snapshot) continue; // unrecomputable order (or no promo on it at all), reported elsewhere
    if (!snapshot.applicable.has(l.variant_id)) {
      violations.push({
        order_no: l.order_no,
        order_id: l.order_id,
        line_no: l.line_no,
        product_name: l.product_name,
        variant_id: l.variant_id,
        promo_discount: l.promo_discount,
      });
    }
  }
  return violations;
}

export interface AsymmetricPromoCase {
  order_no: string;
  order_id: string;
  promo_discount_total: number;
  shape: "promo_id_set_zero_discount" | "discount_set_no_promo_id";
}

// Check 3: the two asymmetric cases, checked over every COMPLETED order
// regardless of whether a snapshot exists -- neither case needs one.
export function checkPromoAsymmetry(
  orders: readonly { order_id: string; order_no: string; applied_promotion_id: string; promo_discount_total: number }[],
): AsymmetricPromoCase[] {
  const cases: AsymmetricPromoCase[] = [];
  for (const o of orders) {
    const hasPromoId = o.applied_promotion_id !== "";
    if (hasPromoId && o.promo_discount_total === 0) {
      cases.push({ order_no: o.order_no, order_id: o.order_id, promo_discount_total: o.promo_discount_total, shape: "promo_id_set_zero_discount" });
    }
    if (!hasPromoId && o.promo_discount_total > 0) {
      cases.push({ order_no: o.order_no, order_id: o.order_id, promo_discount_total: o.promo_discount_total, shape: "discount_set_no_promo_id" });
    }
  }
  return cases;
}
