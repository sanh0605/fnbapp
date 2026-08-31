import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

// Type-only, erased at compile time -- does not run before dotenv.config()
// the way a value import from this module's siblings would.
import type {
  RevenueOrder,
  RevenueLine,
  RevenuePayment,
  RevenueLineDetail,
  RevenuePromoOrder,
  RevenuePromoLine,
  MonthlyBaseline,
} from "./verify-revenue-core";

/**
 * Plan H, tasks H1, H2 and H3 (docs/superpowers/plans/2026-08-14-revenue-audit.md).
 * Re-runnable revenue verification: every check in section 1 (H1), line-
 * level arithmetic (H2, section 3 first bullet), and promotion discount
 * recomputation (H3, section 3 second bullet), against live data. Prints
 * the figures, exits non-zero if any structural check finds a violation.
 *
 * Read-only. No writes, no --apply, no migration -- this script audits.
 *
 * Run: npx vite-node scripts/verify-revenue.ts
 *
 * Gated (exit 1 on failure):
 *   - H1 checks 1-4, H2 checks 1-4, and H3 checks 1-4, zero violations
 *     required (H3's "unrecomputable" orders are reported, never gated --
 *     see the H3 section below for why)
 *   - row-count sanity (trap #1 below)
 *   - every CLOSED month present in the data (docs/superpowers/plans/
 *     2026-09-01-revenue-gate-must-notice-closed-months.md): revenue AND
 *     order count, exact match against KNOWN_MONTHLY_BASELINES. The month
 *     list is derived from the data itself, not a hardcoded array, so a
 *     newly-closed month cannot silently go unchecked the way August once
 *     did -- and a closed month with NO baseline in the table is itself a
 *     gated failure (the script must never mint its own baseline; see
 *     that plan's section 1.4). The still-running month is printed only,
 *     same as before.
 *   - overall COMPLETED order count, floor only (>= EXPECTED_ORDER_COUNT):
 *     it only grows as the shop sells, so a floor is the honest gate, not
 *     an exact match
 *
 * Printed, not gated: overall revenue total, the current (still open)
 * month's figures, H1 check 4's own order-count/amount breakdown beyond
 * "zero violations" (grows as more sales record a payment), the no-payment
 * bucket (section 2: permanently unverifiable, not a target to shrink),
 * H2's empty-modifier-line count (informational, not a violation), and H3's
 * unrecomputable-order count/reason (a known V1-era data gap, not this
 * script's failure to check).
 *
 * H2's formula (gross_line_total = (unit_price + sum(modifier.price *
 * modifier.qty)) * qty) was derived BEFORE touching any data, from the
 * write path itself: lib/order-cart.ts's buildLine (live checkout and
 * order-edit, which reuses the same function) and lib/historical/
 * history-ops/migrate-v1-to-v2.ts's line builder (the V1->V2 migration)
 * compute it independently and agree exactly. Neither was read after
 * getting a result from live data -- both were read first.
 *
 * H3 -- WHAT THIS CANNOT SEE, stated here and again at print time:
 * OPEN-ITEMS 39 says the POS previews a promo price with one calculation
 * and charges with another; only the charged figure was ever written down,
 * so nothing below confirms or refutes what the cashier was shown -- that
 * data does not exist to recover. H3 only checks whether the CHARGED
 * discount agrees with the terms of the promotion recorded on the order at
 * the time, recomputed from lib/order-cart.ts's computePromoForLine (the
 * function that actually decided what got charged), derived before touching
 * any data. See scripts/verify-revenue-core.ts's own H3 section comment for
 * the three discount_type formulas and how they were derived.
 */

const EXPECTED_ORDER_COUNT = 2086;

// Owner-verified measurements -- the ONLY source of truth this script is
// allowed to compare against. Never derived by the script itself (section
// 1.4, and this task's own instruction): a closed month absent from this
// table is a failure to fix by measuring and asking the owner to confirm,
// never by having the script fill in its own number.
//
// April-July: 2026-08-14 (plan docs/superpowers/plans/2026-08-14-revenue-audit.md).
// August: 2026-09-01, after the owner asked why the table stopped at July
// (docs/superpowers/plans/2026-09-01-revenue-gate-must-notice-closed-months.md
// section 1.7) -- re-measured live before writing this, matching exactly:
// 17.682.000d / 644 orders (OUT-001 476/10.557.000d, OUT-002 168/7.125.000d,
// 31/31 sale days).
const KNOWN_MONTHLY_BASELINES: Record<string, MonthlyBaseline | undefined> = {
  "2026-04": { revenue: 2_190_000, orderCount: 53 },
  "2026-05": { revenue: 7_675_000, orderCount: 302 },
  "2026-06": { revenue: 22_157_000, orderCount: 793 },
  "2026-07": { revenue: 18_661_000, orderCount: 664 },
  "2026-08": { revenue: 17_682_000, orderCount: 644 },
};

async function main(): Promise<void> {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const { formatNumber } = await import("../lib/format");
  const { saigonBucketKeys } = await import("../lib/report-time");
  const {
    checkHeaderArithmetic,
    checkLineSum,
    checkNoSupersededCompleted,
    checkPayments,
    buildMonthlyReport,
    meetsMinimumOrderCount,
    checkLineGrossFormula,
    checkLineNetFormula,
    checkOrderLineSums,
    checkLineSanity,
    parsePromotionSnapshot,
    checkPromoRecomputation,
    checkPromoEligibility,
    checkLineVariantCoverage,
    checkPromoAsymmetry,
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
  // lineIdByKey and promoReasonsByOrderId are presentation-only (grouping
  // and H3 check 3 reporting below), not part of any check.
  const lineIdByKey = new Map<string, string>();
  const promoReasonsByOrderId = new Map<string, Set<string>>();
  const lineDetails: RevenueLineDetail[] = rawCompletedLines.map(l => {
    lineIdByKey.set(`${l.order_id}:${l.line_no}`, l.id);
    if (l.promo_discount_reason) {
      const set = promoReasonsByOrderId.get(l.order_id) ?? new Set<string>();
      set.add(l.promo_discount_reason);
      promoReasonsByOrderId.set(l.order_id, set);
    }
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
      variant_id: l.variant_id,
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

  // --- H3: promotion discount recomputation -------------------------------
  console.log(
    "\n=== H3: promotion discount recomputation (docs/superpowers/plans/2026-08-14-revenue-audit.md section 3) ===",
  );
  console.log(
    "WHAT THIS CANNOT SEE (OPEN-ITEMS 39): the POS previews a promo price with one calculation and charges with " +
      "another; only the charged figure was ever written down. What the cashier was shown is gone and no audit can " +
      "recover it. Nothing below confirms or refutes OPEN-ITEMS 39 -- it only checks whether the CHARGED discount " +
      "agrees with the terms of the promotion recorded on the order at the time.",
  );

  const promoOrders: RevenuePromoOrder[] = completedRaw.map(o => {
    let snapshotRaw: any = null;
    try {
      const parsed = JSON.parse(o.applied_promotion_snapshot_json || "{}");
      snapshotRaw = Object.keys(parsed).length > 0 ? parsed : null;
    } catch {
      snapshotRaw = null; // malformed outer JSON -- unrecomputable, same as absent
    }
    return {
      order_id: o.id,
      order_no: o.order_no,
      created_at: o.created_at,
      gross_total: Number(o.gross_total) || 0,
      applied_promotion_id: o.applied_promotion_id || "",
      promo_discount_total: Number(o.promo_discount_total) || 0,
      snapshot: parsePromotionSnapshot(snapshotRaw),
    };
  });

  const promoLines: RevenuePromoLine[] = lineDetails.map(l => ({
    order_id: l.order_id,
    order_no: l.order_no,
    line_no: l.line_no,
    product_name: l.product_name,
    variant_id: l.variant_id,
    unit_price: l.unit_price,
    qty: l.qty,
    gross_line_total: l.gross_line_total,
    promo_discount: l.promo_discount,
  }));
  const promoLinesByOrderId = new Map<string, RevenuePromoLine[]>();
  for (const l of promoLines) {
    const list = promoLinesByOrderId.get(l.order_id) ?? [];
    list.push(l);
    promoLinesByOrderId.set(l.order_id, list);
  }

  function groupByPromotion<T extends { order_id: string }>(items: T[]): Map<string, T[]> {
    const snapshotIdByOrderId = new Map(promoOrders.map(o => [o.order_id, o.snapshot?.id || o.applied_promotion_id || "(none)"]));
    const groups = new Map<string, T[]>();
    for (const item of items) {
      const key = snapshotIdByOrderId.get(item.order_id) || "(unknown)";
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return groups;
  }

  // H3 check 1: recompute from the snapshot.
  const h3Check1 = checkPromoRecomputation(promoOrders, promoLinesByOrderId);
  const ordersWithPromoId = promoOrders.filter(o => o.applied_promotion_id !== "").length;
  console.log(
    `\nH3 check 1 (promo_discount recomputed from applied_promotion_snapshot_json): ` +
      `${h3Check1.recomputedOrderCount} order(s) recomputed / ${ordersWithPromoId} with applied_promotion_id set, ` +
      `${h3Check1.unrecomputable.length} unrecomputable.`,
  );
  if (h3Check1.unrecomputable.length > 0) {
    const groups = groupByPromotion(h3Check1.unrecomputable);
    console.log(
      `  Unrecomputable orders (applied_promotion_id set, applied_promotion_snapshot_json empty) -- known V1-era gap, ` +
        `not this script's failure to check (see lib/historical/history-ops/migrate-v1-to-v2.ts's own "legacy E.1 bug ` +
        `pattern" note; migration copied V1's snapshot verbatim, and V1 sometimes never wrote one):`,
    );
    for (const [promoId, group] of groups) {
      console.log(`    ${promoId}: ${group.length} order(s), e.g. ${group.slice(0, 5).map(o => o.order_no).join(", ")}${group.length > 5 ? ", ..." : ""}`);
    }
    // Not gated -- reported, per the reason above.
  }
  if (h3Check1.orderMismatches.length > 0 || h3Check1.lineMismatches.length > 0) {
    const orderGroups = groupByPromotion(h3Check1.orderMismatches);
    console.log(`  Order-total mismatches: ${h3Check1.orderMismatches.length}, by promotion:`);
    let totalAtStake = 0;
    let overcharged = 0;
    let undercharged = 0;
    for (const [promoId, group] of orderGroups) {
      console.log(`    -- ${promoId} (${group.length}) --`);
      for (const m of group.slice(0, 10)) {
        const diff = m.actual - m.expected;
        totalAtStake += Math.abs(diff);
        if (diff > 0) overcharged++; else if (diff < 0) undercharged++;
        console.log(`      ${m.order_no}: recomputed ${m.expected}, actually charged ${m.actual}, diff ${diff}`);
      }
      if (group.length > 10) console.log(`      ...and ${group.length - 10} more.`);
    }
    console.log(
      `  Total at stake (order-level, |actual - recomputed|): ${formatNumber(totalAtStake)}d -- if the recomputation is ` +
        `right and the charge was wrong, ${overcharged} order(s) charged MORE than the promotion's own terms (revenue ` +
        `would move DOWN if corrected) and ${undercharged} charged LESS (revenue would move UP if corrected).`,
    );
    if (h3Check1.lineMismatches.length > 0) {
      console.log(`  Line-level mismatches: ${h3Check1.lineMismatches.length}.`);
      for (const m of h3Check1.lineMismatches.slice(0, 10)) {
        console.log(`    ${m.order_no} line ${m.line_no} (${m.product_name}): recomputed ${m.expected}, actual ${m.actual}`);
      }
      if (h3Check1.lineMismatches.length > 10) console.log(`    ...and ${h3Check1.lineMismatches.length - 10} more.`);
    }
    failures.push(`H3 check 1: ${h3Check1.orderMismatches.length} order-total and ${h3Check1.lineMismatches.length} line-level recomputation mismatch(es).`);
  }

  // H3 check 2: eligibility (date window, min_order_value where the
  // snapshot shape carries it).
  const h3Check2 = checkPromoEligibility(promoOrders);
  console.log(`\nH3 check 2 (promotion was actually eligible: date window, min_order_value where recorded): ${h3Check2.length} violation(s).`);
  console.log(
    "  min_order_value is only checked where the snapshot shape carries it -- migrated (V1-origin) snapshots do, " +
      "native V2 snapshots (built via lib/order-snapshot.ts's buildPromotionSnapshot) never captured this field at " +
      "all. Both live promotions (PRM-003, PRM-004) have min_order_value 0, so this has never mattered in practice.",
  );
  for (const v of h3Check2.slice(0, 20)) {
    console.log(`  ${v.order_no} (${v.order_id}): ${v.reason}`);
  }
  if (h3Check2.length > 0) failures.push(`H3 check 2: ${h3Check2.length} eligibility violation(s).`);

  // H3 check 3: the two asymmetric cases. NOT gated (does not push to
  // failures) -- unlike checks 1/2/4, this is not an arithmetic identity
  // that must hold; both shapes have a real, code-confirmed legitimate
  // reading, investigated below rather than assumed. Reported with full
  // detail regardless, per the plan's own framing ("the ones most likely to
  // be real") -- visibility, not a false "FAILED" verdict on designed
  // behaviour.
  const h3Check3 = checkPromoAsymmetry(promoOrders);
  const asym1 = h3Check3.filter(c => c.shape === "promo_id_set_zero_discount");
  const asym2 = h3Check3.filter(c => c.shape === "discount_set_no_promo_id");
  console.log(
    `\nH3 check 3 (asymmetric cases, NOT gated -- see below for why): applied_promotion_id set but promo_discount_total 0: ` +
      `${asym1.length}. promo_discount_total > 0 but no applied_promotion_id: ${asym2.length}.`,
  );

  if (asym1.length > 0) {
    const asym1UnrecomputableCount = asym1.filter(c => !promoOrders.find(o => o.order_id === c.order_id)?.snapshot).length;
    console.log(
      `  applied_promotion_id + 0 discount (${asym1.length}): all ${asym1UnrecomputableCount} of them fall inside H3 check 1's ` +
        `${h3Check1.unrecomputable.length}-order unrecomputable bucket (no snapshot) -- check 1 cannot confirm or refute these ` +
        `systematically. Investigated one by hand (UCK000124, PRM-003 on VAR-018): VAR-018's own list price is 15.000d, ` +
        `identical to PRM-003's flat target for it -- a legitimate 0 discount by the FLAT_PRICE formula, not an error. ` +
        `Not verified for the other ${asym1.length - 1} the same way -- reported, not asserted clean.`,
    );
    for (const c of asym1.slice(0, 10)) {
      console.log(`    ${c.order_no} (${c.order_id})`);
    }
  }

  if (asym2.length > 0) {
    let totalNoPromoDiscount = 0;
    console.log(`  promo_discount_total > 0 with no applied_promotion_id (${asym2.length}) -- real, code-confirmed, not a data artifact:`);
    for (const c of asym2) {
      totalNoPromoDiscount += c.promo_discount_total;
      const reasons = [...(promoReasonsByOrderId.get(c.order_id) ?? [])].join(",") || "(none)";
      console.log(`    ${c.order_no} (${c.order_id}): promo_discount_total ${c.promo_discount_total}, line reason(s): ${reasons}`);
    }
    console.log(
      `  Total: ${formatNumber(totalNoPromoDiscount)}d. Confirmed in code, not inferred: lib/order-cart.ts:420 sets ` +
        `promo_discount_reason to "SNAPSHOT" when a line's charged discount came directly from the client-supplied ` +
        `item.promo_discount_snapshot -- used verbatim even when the SERVER's own promotion resolution (resolvedPromo) ` +
        `came back null, which is exactly why applied_promotion_id stays empty. lib/historical/history-ops/` +
        `migrate-v1-to-v2.ts:366 has the same shape for migrated orders, marked "MIGRATED_PROMO". This is OPEN-ITEMS 39's ` +
        `own territory but a different angle on it -- not "preview differs from what was charged" but "the previewed ` +
        `value WAS what was charged, with no server-side record of which promotion (if any) justified it." If this ` +
        `discount should not have been honoured without a resolvable promotion, revenue would move UP by ` +
        `${formatNumber(totalNoPromoDiscount)}d if corrected -- not corrected here, per the plan's own rule against fixing ` +
        `anything this audit finds.`,
    );
  }

  // H3 check 4: line variant coverage.
  const h3Check4 = checkLineVariantCoverage(promoOrders, promoLines);
  console.log(`\nH3 check 4 (any line carrying promo_discount whose variant the applied promotion does not cover): ${h3Check4.length} violation(s).`);
  for (const v of h3Check4.slice(0, 20)) {
    console.log(`  ${v.order_no} line ${v.line_no} (${v.product_name}, ${v.variant_id}): promo_discount ${v.promo_discount}`);
  }
  if (h3Check4.length > 0) failures.push(`H3 check 4: ${h3Check4.length} line-variant-coverage violation(s).`);

  // --- Monthly table -----------------------------------------------------
  // docs/superpowers/plans/2026-09-01-revenue-gate-must-notice-closed-months.md
  // section 2: the list of months comes from the data (buildMonthlyReport
  // derives it via saigonBucketKeys), not a hardcoded array -- a month
  // absent from a hardcoded list used to be invisible, not merely
  // unchecked. "Today" is Asia/Saigon, the same helper every other
  // Saigon-calendar-date derivation in this codebase uses.
  const todaySaigonDateKey = saigonBucketKeys(new Date().toISOString()).dateKey;
  console.log(`\nMonthly (Asia/Saigon, today = ${todaySaigonDateKey}):`);
  const monthlyReport = buildMonthlyReport(orders, KNOWN_MONTHLY_BASELINES, todaySaigonDateKey);
  for (const m of monthlyReport) {
    if (m.status === "open") {
      console.log(`  ${m.label}: ${formatNumber(m.total)}d (${m.orderCount} orders) -- open month, not gated.`);
      continue;
    }
    if (m.status === "closed_no_baseline") {
      console.log(
        `  ${m.label}: ${formatNumber(m.total)}d (${m.orderCount} orders) -- CLOSED, NO BASELINE.`,
      );
      failures.push(
        `Month ${m.label} has closed (its last day is before ${todaySaigonDateKey}) but carries no known baseline in ` +
          `KNOWN_MONTHLY_BASELINES. The script must not mint its own baseline -- measure this month's real revenue and ` +
          `order count, have the owner confirm them against his own records, then add them to KNOWN_MONTHLY_BASELINES ` +
          `in scripts/verify-revenue.ts.`,
      );
      continue;
    }
    console.log(
      `  ${m.label}: ${formatNumber(m.total)}d (${m.orderCount} orders) -- known: ${formatNumber(m.knownRevenue!)}d ` +
        `(${m.knownOrderCount} orders)${m.status === "matches" ? ", matches" : ", GATE MISMATCH"}`,
    );
    if (m.status === "mismatch") {
      if (m.total !== m.knownRevenue) {
        failures.push(`Month ${m.label}: revenue ${formatNumber(m.total)}d does not match known ${formatNumber(m.knownRevenue!)}d.`);
      }
      if (m.orderCount !== m.knownOrderCount) {
        failures.push(`Month ${m.label}: order count ${m.orderCount} does not match known ${m.knownOrderCount}.`);
      }
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
