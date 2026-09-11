"use server";

import { findAll, findAllNoCache, findAllWhere } from "@/lib/db/tables";
import { requireAdmin } from "@/lib/auth/auth";
import { ORDER_STATUS } from "@/lib/sales/order-types";
import { saigonBucketKeys, toSaigonUtcRange } from "@/lib/shared/report-time";
import { computeProfitAndLoss, listAvailableYears, type PnlFigures } from "@/lib/reports/profit-and-loss";
import { buildPnlTable, type PnlTable } from "@/lib/reports/profit-and-loss-table";

export interface ProfitAndLossReport {
  availableYears: number[];
  figures: PnlFigures;
  table: PnlTable;
}

// BR-PNL-004: ADMIN and MANAGER, the same guard as every other report.
// No try/catch: an engine error must reach the page as an error, never as
// a table of zeros that looks right (plan, question C).
export async function getProfitAndLossReport(year?: number): Promise<ProfitAndLossReport> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const today = saigonBucketKeys(new Date().toISOString()).dateKey;
  const currentYear = Number(today.slice(0, 4));

  // Tables written by RPCs (purchase completion, stocktake confirmation,
  // issue slips) do not revalidate the findAll cache tag, so everything
  // mutable is read uncached. Purchased_Items and Item_Categories are read
  // the way getPnLDataV2 reads them.
  const [
    firstOrders, firstPayments, cashEntries, cashCategories, purchaseOrders, purchaseOrderLines,
    purchasedItems, itemCategories, stockIssues, stocktakeSessions, assets, assetDisposals,
  ] = await Promise.all([
    findAllWhere("Orders_V2", { eq: { status: ORDER_STATUS.COMPLETED }, order: { column: "created_at", ascending: true }, limit: 1 }),
    findAllWhere("Order_Payments", { order: { column: "created_at", ascending: true }, limit: 1 }),
    findAllNoCache("Cash_Entries"),
    findAllNoCache("Cash_Categories"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Purchase_Order_Lines"),
    findAll("Purchased_Items"),
    findAll("Item_Categories"),
    findAllNoCache("Stock_Issues"),
    findAllNoCache("stocktake_sessions"),
    findAllNoCache("assets"),
    findAllNoCache("asset_disposals"),
  ]);

  const availableYears = listAvailableYears(
    [
      firstOrders[0]?.created_at ? saigonBucketKeys(firstOrders[0].created_at).dateKey : null,
      ...(cashEntries as any[]).map(e => e.entry_date),
      ...(purchaseOrders as any[])
        .filter(po => po.status === "COMPLETED")
        .map(po => saigonBucketKeys(po.transaction_date || po.created_at).dateKey),
      ...(assets as any[]).map(a => a.acquired_date),
    ],
    currentYear,
  );
  const selectedYear = year !== undefined && availableYears.includes(year) ? year : availableYears[0];

  const yearRange = toSaigonUtcRange(`${selectedYear}-01-01`, `${selectedYear}-12-31`)!;
  const orders = await findAllWhere("Orders_V2", {
    eq: { status: ORDER_STATUS.COMPLETED },
    gte: { created_at: yearRange.startUtc },
    lte: { created_at: yearRange.endUtc },
  });

  const figures = computeProfitAndLoss({
    year: selectedYear,
    today,
    orders: orders as any[],
    cashEntries: cashEntries as any[],
    cashCategories: cashCategories as any[],
    purchaseOrders: purchaseOrders as any[],
    purchaseOrderLines: purchaseOrderLines as any[],
    purchasedItems: purchasedItems as any[],
    itemCategories: itemCategories as any[],
    stockIssues: stockIssues as any[],
    stocktakeSessions: stocktakeSessions as any[],
    assets: assets as any[],
    assetDisposals: assetDisposals as any[],
    firstPaymentAt: (firstPayments[0] as any)?.created_at ?? null,
  });

  return { availableYears, figures, table: buildPnlTable(figures, today) };
}
