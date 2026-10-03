import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

// Read-only. No writes, no --apply. Run after migration 0107 is applied:
//   npx vite-node scripts/verify-cash-book.ts
//
// For every month end from 2026-03 (the first money row is 2026-03-26) to the
// current month, compares the closing cash / bank / total of the cash book as
// the app computes it (the cash_book_daily view through summariseCashBook)
// with an independent sum over the raw tables (orders_v2, order_payments,
// purchase_orders, cash_entries, cash_transfers), which never touches the view.
// Prints "N lệch trên M tháng × 3 số" and exits 1 on any difference.
// Plan: docs/superpowers/plans/2026-10-04-so-thu-chi-dong-tien.md Task 4.

const FIRST_MONTH = "2026-03";

function fmt(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}

async function main(): Promise<void> {
  const { findAllNoCache } = await import("@/lib/db/tables");
  const { readCashBookDaily } = await import("@/lib/finance/cash-book-daily");
  const { summariseCashBook } = await import("@/lib/finance/cash-flow");
  const { toSaigonIsoString } = await import("@/lib/shared/datetime");
  const { monthEnds, independentClosings, compareClosings, describeResult } = await import("./verify-cash-book-core");

  const today = toSaigonIsoString(new Date()).slice(0, 10);
  const ends = monthEnds(FIRST_MONTH, today);
  if (ends.length === 0) throw new Error(`No month from ${FIRST_MONTH} through ${today}`);
  const lastEnd = ends[ends.length - 1];

  console.log("Loading orders_v2, order_payments, purchase_orders, cash_entries, cash_transfers, cash_categories, cash_book_daily...");
  const [orders, payments, purchaseOrders, entries, transfers, categories, dayRows] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Payments"),
    findAllNoCache("Purchase_Orders"),
    findAllNoCache("Cash_Entries"),
    findAllNoCache("Cash_Transfers"),
    findAllNoCache("Cash_Categories"),
    readCashBookDaily(lastEnd),
  ]);
  console.log(
    `${orders.length} orders, ${payments.length} payment rows, ${purchaseOrders.length} purchase orders, ` +
    `${entries.length} hand rows, ${transfers.length} transfers, ${dayRows.length} day rows.`,
  );

  // The app's path: the view's rows through summariseCashBook, one range per
  // month; the closing balance of that range is the month-end figure.
  const appClosings = new Map<string, { cash: number; bank: number; total: number }>();
  for (const end of ends) {
    const summary = summariseCashBook({
      dayRows, entries, transfers, categories, start: `${end.slice(0, 7)}-01`, end,
    });
    appClosings.set(end, summary.closing);
  }

  const raw = {
    orders: orders as any[],
    payments: payments as any[],
    purchaseOrders: purchaseOrders as any[],
    entries: entries as any[],
    transfers: transfers as any[],
    categories: categories as any[],
  };
  const independent = independentClosings(raw, ends);

  console.log("\nmonth end  | tiền mặt | ngân hàng | tổng");
  for (const end of ends) {
    const f = appClosings.get(end)!;
    console.log(`${end} | ${fmt(f.cash)} | ${fmt(f.bank)} | ${fmt(f.total)}`);
  }

  const result = compareClosings(appClosings, independent);
  console.log(`\n${describeResult(result)}`);
  if (result.differences.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
