"use server";

import { findAll, findAllNoCache } from "@/lib/db/tables";
import { requireAdmin } from "@/lib/auth/auth";
import { buildIssueCostingPurchases, buildIssueCostingIssues, buildClassifiedIssues, selectCostedIssues } from "@/lib/costing/issue-costing-inputs";
import { computeIssuedItemFigures, computeIssuedEventFigures, computeIssuedMonthFigures } from "@/lib/reports/issued-value-report";
import { displayMoney } from "@/lib/reports/display-rounding";
import { toSaigonUtcRange } from "@/lib/shared/report-time";
import type { RangeValue } from "@/lib/shared/date-range-params";
import { endOfMonth } from "@/lib/shared/date-range-presets";

export interface IssuedItemRow {
  purchasedItemId: string;
  name: string;
  unitName: string;
  issuedQuantity: number;
  issuedValue: number;
  closingValue: number;
}

export interface IssuedEventRow {
  key: string;
  kind: "STOCKTAKE" | "MANUAL";
  label: string;
  at: string;
  itemCount: number;
  value: number;
}

export interface IssuedMonthRow {
  yearMonth: string;
  usedValue: number; // Hàng dùng
  shrinkageValue: number; // Hao hụt
}

// Everything is for the whole months of the range. grandTotal = usedTotal + shrinkageTotal,
// before rounding; each total is rounded from its own exact sum, like Lãi lỗ's total column.
export interface IssuedValueReport {
  grandTotal: number;
  usedTotal: number;
  shrinkageTotal: number;
  items: IssuedItemRow[];
  events: IssuedEventRow[];
  months: IssuedMonthRow[];
}

// Plan G: a read-only monitoring page for the value of goods issued so far.
// Reuses lib/costing/issue-costing.ts, the buildIssueCosting* input builders (Plan G
// G1), and lib/reports/issued-value-report.ts's per-event derivation -- the same
// functions app/admin/reports/pnl-actions.ts uses for totalCOGS. No second cost
// definition lives here; this file only fetches, names, and rounds for
// display.
export async function getIssuedValueReport(range: RangeValue): Promise<IssuedValueReport> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [purchaseOrders, purchaseOrderLines, stockIssues, stocktakeSessions, purchasedItems, units, conversions, itemCategories] = await Promise.all([
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Stock_Issues"),
    findAllNoCache("stocktake_sessions"),
    findAll("Purchased_Items"),
    findAll("Units"),
    findAll("UOM_Conversions"),
    findAll("Item_Categories"),
  ]);

  const purchases = buildIssueCostingPurchases(purchaseOrders as any[], purchaseOrderLines as any[]);
  // section 3.2, widened by BR-COGS-007 (2026-09-11): same exclusion as
  // getPnLDataV2 (app/admin/reports/pnl-actions.ts) -- this report reuses the
  // same issue-costing engine, so it inherited the same gap and gets the
  // same fix, from the one shared function.
  const costedIssues = selectCostedIssues(stockIssues as any[], purchasedItems as any[], itemCategories as any[]);
  const allIssues = buildIssueCostingIssues(costedIssues);
  // Whole months in Saigon time, the same span Lãi lỗ reads.
  const span = toSaigonUtcRange(`${range.start}-01`, endOfMonth(`${range.end}-01`))!;

  const nameById = new Map<string, string>((purchasedItems as any[]).map(p => [p.id, p.name]));
  const unitNameById = new Map<string, string>((units as any[]).map(u => [u.id, u.name]));
  // OPEN-ITEMS 41: purchased_items.default_unit_id never held a value (dropped by 0133)
  // (measured 2026-08-13), so the base unit has to come from
  // UOM_Conversions.base_unit instead -- the same source
  // getIssueSlipFormData already uses for baseUnitName
  // (app/admin/inventory/issue-slips/actions.ts:55). All 52 items have
  // exactly one ACTIVE base unit and none disagree (verified 2026-08-13);
  // takes the first ACTIVE conversion found per item on that basis, not as
  // an unchecked assumption.
  const baseUnitIdByPurchasedItem = new Map<string, string>();
  for (const c of conversions as any[]) {
    if (c.status !== "ACTIVE") continue;
    if (!baseUnitIdByPurchasedItem.has(c.purchased_item_id)) {
      baseUnitIdByPurchasedItem.set(c.purchased_item_id, c.base_unit);
    }
  }

  const itemFigures = computeIssuedItemFigures(purchases, allIssues, span.startUtc, span.endUtc);
  const items: IssuedItemRow[] = itemFigures
    .filter(f => Math.abs(f.issuedValueExact) > 0.005)
    .map(f => ({
      purchasedItemId: f.purchasedItemId,
      name: nameById.get(f.purchasedItemId) ?? f.purchasedItemId,
      unitName: unitNameById.get(baseUnitIdByPurchasedItem.get(f.purchasedItemId) ?? "") ?? "",
      issuedQuantity: f.issuedQuantity,
      issuedValue: displayMoney(f.issuedValueExact),
      closingValue: displayMoney(f.closingValueExact),
    }))
    .sort((a, b) => b.issuedValue - a.issuedValue);

  const grandTotal = displayMoney(itemFigures.reduce((sum, f) => sum + f.issuedValueExact, 0));

  // BR-COGS-007 (2026-09-11): this "Theo lần xuất" tab used to pass the
  // unfiltered stockIssues here, so an equipment or bought-for-immediate-use
  // issue slip would still show up in the by-event list even though it is
  // excluded everywhere else on this page.
  const eventFigures = computeIssuedEventFigures(costedIssues, purchases, nameById).filter(f => {
    const at = new Date(f.at).getTime();
    return at >= span.startUtc.getTime() && at <= span.endUtc.getTime();
  });
  const events: IssuedEventRow[] = eventFigures.map(f => ({
    key: f.key,
    kind: f.kind,
    label: f.label,
    at: f.at,
    itemCount: f.itemCount,
    value: displayMoney(f.valueExact),
  }));

  const classifiedIssues = buildClassifiedIssues(costedIssues, stocktakeSessions as any[]);
  const monthFigures = computeIssuedMonthFigures(purchases, classifiedIssues, range.start, range.end);
  const months: IssuedMonthRow[] = monthFigures.map(f => ({
    yearMonth: f.yearMonth,
    usedValue: displayMoney(f.costExact),
    shrinkageValue: displayMoney(f.shrinkageExact),
  }));
  const usedTotal = displayMoney(monthFigures.reduce((sum, f) => sum + f.costExact, 0));
  const shrinkageTotal = displayMoney(monthFigures.reduce((sum, f) => sum + f.shrinkageExact, 0));

  return { grandTotal, usedTotal, shrinkageTotal, items, events, months };
}
