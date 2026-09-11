import { ORDER_STATUS, coerceOrderV2 } from "@/lib/sales/order-types";
import { saigonBucketKeys, toSaigonUtcRange } from "@/lib/shared/report-time";
import { allocatePurchaseOrderCost } from "@/lib/costing/purchase-order-cost-allocation";
import { computePeriodIssuedValueSplit } from "@/lib/costing/issue-costing";
import {
  buildClassifiedIssues,
  buildIssueCostingPurchases,
  isNonInventoryItem,
  selectCostedIssues,
} from "@/lib/costing/issue-costing-inputs";
import { computeIssuedEventFigures } from "@/lib/reports/issued-value-report";
import { buildAssetSchedule, chargeForMonth, type DisposalInput } from "@/lib/assets/asset-depreciation";

// docs/superpowers/specs/2026-09-11-bao-cao-lai-lo-design.md. Every figure
// is recomputed from source rows on every read -- nothing here is stored,
// and no month is ever locked (owner, 2026-09-08). Values stay exact; the
// display layer (lib/reports/profit-and-loss-table.ts) rounds them.

export type PnlSourceKind = "CASH_ENTRY" | "PO_LINE" | "STOCKTAKE" | "ISSUE_SLIP" | "ASSET";

export interface PnlSource {
  kind: PnlSourceKind;
  id: string;            // cash entry id, PO line id, session id, slip id, asset id
  date: string | null;   // "YYYY-MM-DD" Saigon; null for depreciation
  label: string;         // what the owner reads: note, item name, asset name
  ref: string | null;    // purchase order id for PO_LINE, otherwise null
  amountExact: number;
}

export interface PnlMonthFigures {
  month: string;                     // "YYYY-MM"
  posRevenue: number;
  posOrderCount: number;
  posRevenueBeforePayments: number;  // part of posRevenue with no payment record to check against
  manualRevenue: number;
  cogsExact: number;
  shrinkageExact: number;
  nonInventoryExact: number;
  expenseByCategory: Record<string, number>;
  otherIncome: number;
  depreciationExact: number;
  sources: {
    manualRevenue: PnlSource[];
    cogs: PnlSource[];
    shrinkage: PnlSource[];
    nonInventory: PnlSource[];
    expense: Record<string, PnlSource[]>;
    otherIncome: PnlSource[];
    depreciation: PnlSource[];
  };
}

export interface PnlFigures {
  year: number;
  months: PnlMonthFigures[];
  expenseCategories: Array<{ id: string; name: string }>;
  firstPaymentDate: string | null;   // "YYYY-MM-DD" Saigon
}

export interface PnlInput {
  year: number;
  today: string;                     // "YYYY-MM-DD" Saigon
  orders: any[];
  cashEntries: any[];
  cashCategories: any[];
  purchaseOrders: any[];
  purchaseOrderLines: any[];
  purchasedItems: any[];
  itemCategories: any[];
  stockIssues: any[];
  stocktakeSessions: any[];
  assets: any[];
  assetDisposals: any[];
  firstPaymentAt: string | null;     // ISO timestamp of the earliest order_payments row
}

const NEAR_ZERO = 0.005;

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

// January of `year` through the current month (this year) or December (a
// past year). A future year has no months.
function candidateMonths(year: number, today: string): string[] {
  const currentYear = Number(today.slice(0, 4));
  if (year > currentYear) return [];
  const last = year === currentYear ? Number(today.slice(5, 7)) : 12;
  return Array.from({ length: last }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

function emptyMonth(month: string): PnlMonthFigures {
  return {
    month,
    posRevenue: 0, posOrderCount: 0, posRevenueBeforePayments: 0, manualRevenue: 0,
    cogsExact: 0, shrinkageExact: 0, nonInventoryExact: 0,
    expenseByCategory: {}, otherIncome: 0, depreciationExact: 0,
    sources: { manualRevenue: [], cogs: [], shrinkage: [], nonInventory: [], expense: {}, otherIncome: [], depreciation: [] },
  };
}

function hasAnyFigure(m: PnlMonthFigures): boolean {
  const figures = [
    m.posRevenue, m.manualRevenue, m.cogsExact, m.shrinkageExact, m.nonInventoryExact,
    m.otherIncome, m.depreciationExact, ...Object.values(m.expenseByCategory),
  ];
  return m.posOrderCount > 0 || figures.some(x => Math.abs(x) > NEAR_ZERO);
}

const byDateThenId = (a: PnlSource, b: PnlSource) =>
  (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id);
const byAmountDesc = (a: PnlSource, b: PnlSource) => b.amountExact - a.amountExact || a.id.localeCompare(b.id);

export function computeProfitAndLoss(input: PnlInput): PnlFigures {
  const months = candidateMonths(input.year, input.today);
  const byMonth = new Map(months.map(m => [m, emptyMonth(m)]));

  // 1. POS revenue: exactly getPnLDataV2's filter (app/admin/reports/actions.ts).
  const firstPaymentMs = input.firstPaymentAt ? new Date(input.firstPaymentAt).getTime() : null;
  for (const o of input.orders) {
    if (o.status !== ORDER_STATUS.COMPLETED) continue;
    if (o.superseded_by && o.superseded_by !== "") continue;
    if (!o.created_at) continue;
    const m = byMonth.get(saigonBucketKeys(o.created_at).monthKey);
    if (!m) continue;
    const net = coerceOrderV2(o).net_total;
    m.posRevenue += net;
    m.posOrderCount += 1;
    // BR-SALE-005: before the first payment record, revenue can only be
    // checked against itself.
    if (firstPaymentMs === null || new Date(o.created_at).getTime() < firstPaymentMs) {
      m.posRevenueBeforePayments += net;
    }
  }

  // 2. Cash book: ACTIVE rows of categories that count in P&L (BR-CASH-002,
  // BR-CASH-003). A sales-revenue category (BR-CASH-006) is revenue, any
  // other income category is Thu khác.
  const categoryById = new Map(input.cashCategories.map(c => [c.id, c]));
  for (const e of input.cashEntries) {
    if (e.status !== "ACTIVE") continue;
    const category = categoryById.get(e.category_id);
    if (!category) {
      throw new Error(`Dòng sổ ${e.id} trỏ tới nhóm ${e.category_id}, nhưng không tìm thấy nhóm này`);
    }
    if (!category.affects_pnl) continue;
    const date = String(e.entry_date).slice(0, 10);
    const m = byMonth.get(date.slice(0, 7));
    if (!m) continue;
    const amount = Number(e.amount);
    const source: PnlSource = {
      kind: "CASH_ENTRY", id: e.id, date, label: e.note?.trim() || "Không có ghi chú", ref: null, amountExact: amount,
    };
    if (category.kind === "EXPENSE") {
      m.expenseByCategory[category.id] = (m.expenseByCategory[category.id] ?? 0) + amount;
      (m.sources.expense[category.id] ??= []).push(source);
    } else if (category.is_sales_revenue === true) {
      m.manualRevenue += amount;
      m.sources.manualRevenue.push(source);
    } else {
      m.otherIncome += amount;
      m.sources.otherIncome.push(source);
    }
  }

  // 3. Bought for immediate use (BR-COGS-007): completed orders only, each
  // line at its paid share (BR-COGS-006), in the order's Saigon month.
  // Equipment never counts here -- it depreciates.
  const itemById = new Map(input.purchasedItems.map(p => [p.id, p]));
  const equipmentCategoryIds = new Set(
    input.itemCategories.filter(c => c.system_type === "EQUIPMENT").map(c => c.id),
  );
  const linesByOrder = new Map<string, any[]>();
  for (const line of input.purchaseOrderLines) {
    const list = linesByOrder.get(line.purchase_order_id) ?? [];
    list.push(line);
    linesByOrder.set(line.purchase_order_id, list);
  }
  for (const po of input.purchaseOrders) {
    if (po.status !== "COMPLETED") continue;
    const lines = linesByOrder.get(po.id) ?? [];
    const flagged = lines.filter(l => {
      const item = itemById.get(l.purchased_item_id);
      return !!item && isNonInventoryItem(item) && !equipmentCategoryIds.has(item.item_category_id);
    });
    if (flagged.length === 0) continue;
    const keys = saigonBucketKeys(po.transaction_date || po.created_at);
    const m = byMonth.get(keys.monthKey);
    if (!m) continue;
    const paidByLineId = allocatePurchaseOrderCost(
      lines.map(l => ({ lineId: l.id, subtotal: Number(l.subtotal) || 0 })),
      (Number(po.shipping_fee) || 0) + (Number(po.tax_amount) || 0),
      (Number(po.voucher_amount) || 0) + (Number(po.discount_amount) || 0),
    );
    for (const line of flagged) {
      const amount = paidByLineId.get(line.id) ?? (Number(line.subtotal) || 0);
      m.nonInventoryExact += amount;
      m.sources.nonInventory.push({
        kind: "PO_LINE", id: line.id, date: keys.dateKey,
        label: itemById.get(line.purchased_item_id)?.name ?? line.purchased_item_id,
        ref: po.id, amountExact: amount,
      });
    }
  }

  // 4. Cost of goods and shrinkage: the same engine and inputs as
  // getPnLDataV2, so Giá vốn + Hao hụt equals its totalCOGS for every month
  // (scripts/verify-pnl-monthly.ts checks this on real data).
  const purchases = buildIssueCostingPurchases(input.purchaseOrders, input.purchaseOrderLines);
  const costedIssues = selectCostedIssues(input.stockIssues, input.purchasedItems, input.itemCategories);
  const classifiedIssues = buildClassifiedIssues(costedIssues, input.stocktakeSessions);
  for (const month of months) {
    const range = toSaigonUtcRange(`${month}-01`, lastDayOfMonth(month))!;
    const split = computePeriodIssuedValueSplit(purchases, classifiedIssues, range.startUtc, range.endUtc);
    const m = byMonth.get(month)!;
    m.cogsExact = split.cost;
    m.shrinkageExact = split.shrinkage;
  }
  // Which count or slip makes up each month's figure. Classified the same
  // way buildClassifiedIssues does: a count is shrinkage unless its session
  // says it is not.
  const notShrinkageSessionIds = new Set(
    input.stocktakeSessions.filter(s => s.is_shrinkage === false).map(s => s.id),
  );
  for (const event of computeIssuedEventFigures(costedIssues, purchases)) {
    const keys = saigonBucketKeys(event.at);
    const m = byMonth.get(keys.monthKey);
    if (!m || Math.abs(event.valueExact) <= NEAR_ZERO) continue;
    const groupId = event.key.slice(2); // "S:<session_id>" or "M:<issue_slip_id>"
    if (event.kind === "STOCKTAKE") {
      const source: PnlSource = {
        kind: "STOCKTAKE", id: groupId, date: keys.dateKey, label: "Kiểm kê định kỳ", ref: null, amountExact: event.valueExact,
      };
      (notShrinkageSessionIds.has(groupId) ? m.sources.cogs : m.sources.shrinkage).push(source);
    } else {
      m.sources.cogs.push({
        kind: "ISSUE_SLIP", id: groupId, date: keys.dateKey, label: `Phiếu xuất: ${event.label}`, ref: null, amountExact: event.valueExact,
      });
    }
  }

  // 5. Depreciation (BR-COGS-008): every asset but INACTIVE ones, which are
  // data-entry mistakes -- the same exclusion as the asset register page.
  const disposalsByAsset = new Map<string, DisposalInput[]>();
  for (const d of input.assetDisposals) {
    const list = disposalsByAsset.get(d.asset_id) ?? [];
    list.push({ quantity: Number(d.quantity), disposed_date: d.disposed_date });
    disposalsByAsset.set(d.asset_id, list);
  }
  for (const asset of input.assets) {
    if (asset.status === "INACTIVE") continue;
    const schedule = buildAssetSchedule(
      {
        acquired_date: asset.acquired_date,
        total_cost: Number(asset.total_cost),
        quantity: Number(asset.quantity),
        term_months: Number(asset.term_months),
      },
      disposalsByAsset.get(asset.id) ?? [],
    );
    for (const month of months) {
      // Exact since Mục 0 (BR-DATA-005): a charge can be 33.333,33...
      const charge = chargeForMonth(schedule, month);
      if (Math.abs(charge) <= NEAR_ZERO) continue;
      const m = byMonth.get(month)!;
      m.depreciationExact += charge;
      m.sources.depreciation.push({
        kind: "ASSET", id: asset.id, date: null, label: asset.name_snapshot, ref: null, amountExact: charge,
      });
    }
  }

  // 6. Months shown: from the first month with anything in it.
  const all = months.map(m => byMonth.get(m)!);
  const first = all.findIndex(hasAnyFigure);
  const shown = first === -1 ? [] : all.slice(first);
  for (const m of shown) {
    m.sources.manualRevenue.sort(byDateThenId);
    m.sources.cogs.sort(byDateThenId);
    m.sources.shrinkage.sort(byDateThenId);
    m.sources.nonInventory.sort(byDateThenId);
    m.sources.otherIncome.sort(byDateThenId);
    for (const list of Object.values(m.sources.expense)) list.sort(byDateThenId);
    m.sources.depreciation.sort(byAmountDesc);
  }

  // 7. Expense groups shown: counting in P&L, and in use or with a figure this year.
  const expenseCategories = input.cashCategories
    .filter(c => c.kind === "EXPENSE" && c.affects_pnl)
    .filter(c => c.status === "ACTIVE" || shown.some(m => Math.abs(m.expenseByCategory[c.id] ?? 0) > NEAR_ZERO))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map(c => ({ id: c.id, name: c.name }));

  return {
    year: input.year,
    months: shown,
    expenseCategories,
    firstPaymentDate: input.firstPaymentAt ? saigonBucketKeys(input.firstPaymentAt).dateKey : null,
  };
}

// saigonDates are "YYYY-MM-DD" Saigon dates -- the caller converts
// timestamps first, so an order at 23:30 on 31/12 lands in the right year.
export function listAvailableYears(saigonDates: Array<string | null | undefined>, currentYear: number): number[] {
  let earliest = currentYear;
  for (const d of saigonDates) {
    if (!d) continue;
    const y = Number(String(d).slice(0, 4));
    if (Number.isInteger(y) && y >= 2000 && y < earliest) earliest = y;
  }
  const years: number[] = [];
  for (let y = currentYear; y >= earliest; y--) years.push(y);
  return years;
}
