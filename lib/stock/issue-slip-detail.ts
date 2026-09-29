import { displayMoney } from "@/lib/reports/display-rounding";
import { formatDate, formatDateTimeFull } from "@/lib/shared/datetime";
import type { PackageLine } from "@/lib/stock/stocktake-package-lines";
import {
  activeSlipLines, reversedIssueIds, slipCancellation, stocktakeLock,
  type IssueRowRecord, type IssueSlipRecord, type StocktakeSessionRecord,
} from "./issue-slip-status";
import { buildIssueUnitOptions, describeQuantity, type IssueUnitOption } from "./issue-unit-options";

export interface IssueSlipDetailLine {
  issueId: string; purchasedItemId: string; name: string; baseQuantity: number; baseUnitName: string;
  quantityText: string; value: number; unitOptions: IssueUnitOption[];
}
export interface IssueSlipDetail {
  id: string; issuedAt: string; dateText: string; note: string; createdByName: string;
  lines: IssueSlipDetailLine[]; totalValue: number;
  cancellation: { at: string; dateText: string; reason: string } | null;
  lock: { sessionId: string; confirmedAt: string; dateText: string } | null;
  canEdit: boolean;
  // Exact weighted-average cost per base unit at the slip's time, keyed by
  // purchased item; an item with no price yet has no key. For edit-mode preview only.
  unitCostByItem: Record<string, number>;
}

export function buildIssueSlipDetail(input: {
  slip: IssueSlipRecord; issues: IssueRowRecord[]; sessions: StocktakeSessionRecord[];
  items: { id: string; name: string }[]; baseUnitNameByItem: Map<string, string>;
  packageLinesByItem: Map<string, PackageLine[]>; lineValues: Map<string, number>;
  unitCostByItem: Record<string, number>;
}): IssueSlipDetail {
  const { slip, issues, sessions, items, baseUnitNameByItem, packageLinesByItem, lineValues, unitCostByItem } = input;
  const reversed = reversedIssueIds(issues);
  const cancel = slipCancellation(slip.id, issues, reversed);
  const lockRaw = stocktakeLock(slip.issued_at, sessions);
  const nameById = new Map(items.map(i => [i.id, i.name]));

  const lines: IssueSlipDetailLine[] = [];
  let exactTotal = 0;
  if (!cancel) {
    const active = activeSlipLines(slip.id, issues, reversed)
      .slice()
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const row of active) {
      const baseQuantity = Number(row.base_quantity);
      const baseUnitName = baseUnitNameByItem.get(row.purchased_item_id) ?? "";
      const unitOptions = buildIssueUnitOptions(baseUnitName, packageLinesByItem.get(row.purchased_item_id) ?? []);
      const exact = lineValues.get(row.id) ?? 0;
      exactTotal += exact;
      lines.push({
        issueId: row.id, purchasedItemId: row.purchased_item_id,
        name: nameById.get(row.purchased_item_id) ?? row.purchased_item_id,
        baseQuantity, baseUnitName,
        quantityText: describeQuantity(baseQuantity, baseUnitName, unitOptions),
        value: displayMoney(exact), unitOptions,
      });
    }
  }

  const cancellation = cancel ? { at: cancel.at, dateText: formatDateTimeFull(cancel.at), reason: cancel.reason } : null;
  const lock = lockRaw
    ? { sessionId: lockRaw.sessionId, confirmedAt: lockRaw.confirmedAt, dateText: formatDate(lockRaw.confirmedAt) }
    : null;
  return {
    id: slip.id, issuedAt: slip.issued_at, dateText: formatDateTimeFull(slip.issued_at),
    note: slip.note ?? "", createdByName: slip.created_by_name ?? "",
    lines, totalValue: cancel ? 0 : displayMoney(exactTotal),
    cancellation, lock, canEdit: !cancellation && !lock, unitCostByItem,
  };
}
