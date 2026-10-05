// Groups purchased lots (assets rows) by purchased item, for the per-item Tài sản
// list and detail pages. Pure, no I/O. Builds on buildAssetSchedule /
// summarizeAsset and changes no depreciation rule. Nothing here rounds: sums are
// exact, display rounds (BR-DATA-005).

import {
  buildAssetSchedule,
  chargeForMonth,
  summarizeAsset,
  totalScheduledCharge,
  type AssetSummary,
  type DisposalInput,
} from "@/lib/assets/asset-depreciation";

export type AssetLotInput = {
  id: string; purchased_item_id: string; purchase_order_id: string | null;
  name_snapshot: string; acquired_date: string; unit_cost: number;
  total_cost: number; quantity: number; term_months: number;
};
export type DisposalRowInput = { id: string; asset_id: string; quantity: number; disposed_date: string; reason: string | null };

export type AssetItemRow = {
  itemId: string;
  name: string;
  quantity: number;
  remainingQuantity: number;
  disposedQuantity: number;
  remainingValue: number;
  latestAcquiredDate: string;
  fullyDisposed: boolean;
};
export type AssetLotView = AssetSummary & { purchaseOrderId: string | null; nameSnapshot: string };
export type AssetItemDisposal = {
  id: string; assetId: string; lotAcquiredDate: string;
  quantity: number; disposedDate: string; reason: string;
  charge: number;
};
export type AssetItemMonth = { month: string; unitsHeld: number; charge: number; disposalCharge: number };
export type AssetItemDetail = {
  item: AssetItemRow & { totalCost: number; chargedToDate: number };
  lots: AssetLotView[];
  disposals: AssetItemDisposal[];
  months: AssetItemMonth[];
};

const natural = (a: string, b: string) => a.localeCompare(b, "vi", { numeric: true });

const byDateThenId = (a: { acquired_date: string; id: string }, b: { acquired_date: string; id: string }) =>
  a.acquired_date.localeCompare(b.acquired_date) || natural(a.id, b.id);

const toInputs = (rows: DisposalRowInput[]): DisposalInput[] =>
  rows.map(d => ({ quantity: Number(d.quantity), disposed_date: d.disposed_date }));

function disposalsByLot(disposals: DisposalRowInput[]): Map<string, DisposalRowInput[]> {
  const map = new Map<string, DisposalRowInput[]>();
  for (const d of disposals) {
    const list = map.get(d.asset_id) ?? [];
    list.push(d);
    map.set(d.asset_id, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.disposed_date.localeCompare(b.disposed_date) || natural(a.id, b.id));
  }
  return map;
}

function summarizeLot(l: AssetLotInput, own: DisposalRowInput[], asOfMonth: string): AssetSummary {
  return summarizeAsset(
    {
      id: l.id, name: l.name_snapshot, acquired_date: l.acquired_date,
      unit_cost: Number(l.unit_cost), total_cost: Number(l.total_cost),
      quantity: Number(l.quantity), term_months: Number(l.term_months),
    },
    toInputs(own),
    asOfMonth,
  );
}

function lotAssetInput(l: AssetLotInput) {
  return {
    acquired_date: l.acquired_date,
    total_cost: Number(l.total_cost),
    quantity: Number(l.quantity),
    term_months: Number(l.term_months),
  };
}

function newestLotName(lots: AssetLotInput[]): string {
  const newest = [...lots].sort(byDateThenId)[lots.length - 1];
  return newest.name_snapshot;
}

function buildRow(itemId: string, lots: AssetLotInput[], byLot: Map<string, DisposalRowInput[]>, itemName: string | undefined, asOfMonth: string) {
  const summaries = lots.map(l => summarizeLot(l, byLot.get(l.id) ?? [], asOfMonth));
  const quantity = summaries.reduce((s, x) => s + x.quantity, 0);
  const remainingQuantity = summaries.reduce((s, x) => s + x.remainingQuantity, 0);
  const row: AssetItemRow = {
    itemId,
    name: itemName ?? newestLotName(lots),
    quantity,
    remainingQuantity,
    disposedQuantity: quantity - remainingQuantity,
    remainingValue: summaries.reduce((s, x) => s + x.remainingValue, 0),
    latestAcquiredDate: lots.reduce((max, l) => (l.acquired_date > max ? l.acquired_date : max), ""),
    fullyDisposed: remainingQuantity === 0,
  };
  return { row, summaries };
}

export function groupAssetItems(
  lots: AssetLotInput[],
  disposals: DisposalRowInput[],
  itemNames: Map<string, string>,
  asOfMonth: string,
): AssetItemRow[] {
  const byLot = disposalsByLot(disposals);
  const byItem = new Map<string, AssetLotInput[]>();
  for (const l of lots) {
    const list = byItem.get(l.purchased_item_id) ?? [];
    list.push(l);
    byItem.set(l.purchased_item_id, list);
  }
  return [...byItem.entries()]
    .map(([itemId, itemLots]) => buildRow(itemId, itemLots, byLot, itemNames.get(itemId), asOfMonth).row)
    .sort((a, b) => natural(a.itemId, b.itemId));
}

export function buildAssetItemDetail(
  itemId: string,
  lots: AssetLotInput[],
  disposals: DisposalRowInput[],
  itemName: string | undefined,
  asOfMonth: string,
): AssetItemDetail | null {
  const itemLots = lots.filter(l => l.purchased_item_id === itemId).sort(byDateThenId);
  if (itemLots.length === 0) return null;

  const byLot = disposalsByLot(disposals);
  const { row, summaries } = buildRow(itemId, itemLots, byLot, itemName, asOfMonth);

  const itemDisposals: AssetItemDisposal[] = [];
  const monthMap = new Map<string, AssetItemMonth>();
  let totalCost = 0;
  let chargedToDate = 0;

  itemLots.forEach((l, idx) => {
    const own = byLot.get(l.id) ?? [];
    const input = lotAssetInput(l);

    // charge(di): what the schedule's month of di gains when di is added to
    // d1..di-1. Summed over a lot, it equals the disposed schedule minus the
    // undisposed one in the months that have a disposal.
    own.forEach((d, i) => {
      const month = d.disposed_date.slice(0, 7);
      const upTo = buildAssetSchedule(input, toInputs(own.slice(0, i + 1)));
      const before = buildAssetSchedule(input, toInputs(own.slice(0, i)));
      itemDisposals.push({
        id: d.id,
        assetId: l.id,
        lotAcquiredDate: l.acquired_date,
        quantity: Number(d.quantity),
        disposedDate: d.disposed_date,
        reason: d.reason ?? "",
        charge: chargeForMonth(upTo, month) - chargeForMonth(before, month),
      });
    });

    const schedule = buildAssetSchedule(input, toInputs(own));
    for (const m of schedule) {
      const cur = monthMap.get(m.month) ?? { month: m.month, unitsHeld: 0, charge: 0, disposalCharge: 0 };
      cur.unitsHeld += m.unitsHeld;
      cur.charge += m.charge;
      monthMap.set(m.month, cur);
    }

    totalCost += Number(l.total_cost);
    chargedToDate += totalScheduledCharge(schedule) - summaries[idx].remainingValue;
  });

  itemDisposals.sort((a, b) => a.disposedDate.localeCompare(b.disposedDate) || natural(a.id, b.id));
  for (const d of itemDisposals) {
    const m = monthMap.get(d.disposedDate.slice(0, 7));
    if (m) m.disposalCharge += d.charge;
  }

  const months = [...monthMap.values()]
    .filter(m => m.charge > 0)
    .sort((a, b) => a.month.localeCompare(b.month));

  const lotViews: AssetLotView[] = itemLots.map((l, idx) => ({
    ...summaries[idx],
    purchaseOrderId: l.purchase_order_id,
    nameSnapshot: l.name_snapshot,
  }));

  return {
    item: { ...row, totalCost, chargedToDate },
    lots: lotViews,
    disposals: itemDisposals,
    months,
  };
}
