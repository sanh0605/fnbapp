"use server";

import { findAll, findAllNoCache } from "@/lib/sheets_db";
import { requireAdmin } from "@/lib/auth";
import { buildIssueCostingPurchases, buildIssueCostingIssues } from "@/lib/issue-costing-inputs";
import { computeIssuedItemFigures, computeIssuedEventFigures } from "@/lib/issued-value-report";
import { displayMoney } from "@/lib/display-rounding";

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

export interface IssuedValueReport {
  grandTotal: number;
  items: IssuedItemRow[];
  events: IssuedEventRow[];
}

// Plan G: a read-only monitoring page for the value of goods issued so far.
// Reuses lib/issue-costing.ts, the buildIssueCosting* input builders (Plan G
// G1), and lib/issued-value-report.ts's per-event derivation -- the same
// functions app/admin/reports/actions.ts uses for totalCOGS. No second cost
// definition lives here; this file only fetches, names, and rounds for
// display.
export async function getIssuedValueReport(): Promise<IssuedValueReport> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const [purchaseOrders, purchaseOrderLines, stockIssues, purchasedItems, units] = await Promise.all([
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAllNoCache("Stock_Issues"),
    findAll("Purchased_Items"),
    findAll("Units"),
  ]);

  const purchases = buildIssueCostingPurchases(purchaseOrders as any[], purchaseOrderLines as any[]);
  const allIssues = buildIssueCostingIssues(stockIssues as any[]);

  const nameById = new Map<string, string>((purchasedItems as any[]).map(p => [p.id, p.name]));
  const unitIdById = new Map<string, string>((purchasedItems as any[]).map(p => [p.id, p.default_unit_id]));
  const unitNameById = new Map<string, string>((units as any[]).map(u => [u.id, u.name]));

  const itemFigures = computeIssuedItemFigures(purchases, allIssues);
  const items: IssuedItemRow[] = itemFigures
    .filter(f => Math.abs(f.issuedValueExact) > 0.005)
    .map(f => ({
      purchasedItemId: f.purchasedItemId,
      name: nameById.get(f.purchasedItemId) ?? f.purchasedItemId,
      unitName: unitNameById.get(unitIdById.get(f.purchasedItemId) ?? "") ?? "",
      issuedQuantity: f.issuedQuantity,
      issuedValue: displayMoney(f.issuedValueExact),
      closingValue: displayMoney(f.closingValueExact),
    }))
    .sort((a, b) => b.issuedValue - a.issuedValue);

  const grandTotal = displayMoney(itemFigures.reduce((sum, f) => sum + f.issuedValueExact, 0));

  const eventFigures = computeIssuedEventFigures(stockIssues as any[], purchases);
  const events: IssuedEventRow[] = eventFigures.map(f => ({
    key: f.key,
    kind: f.kind,
    label: f.label,
    at: f.at,
    itemCount: f.itemCount,
    value: displayMoney(f.valueExact),
  }));

  return { grandTotal, items, events };
}
