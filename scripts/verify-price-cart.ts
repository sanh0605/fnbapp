import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Replay of priceCart over every order, every status (spec 2026-10-15, section 5).
 * Read-only. Run: npx vite-node scripts/verify-price-cart.ts
 * Expected: only order 260618001003 differs (3,000 promotion money, no promotion recorded).
 * Also: every size's price equals its latest price-history row (exit 1 if not).
 */
async function main(): Promise<void> {
  const { findAllNoCache } = await import("@/lib/db/tables");
  const { checkHistoryMatchesPrice, replayOrders } = await import("./verify-price-cart-core");

  const [orders, lines, promotions, variants, history] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Promotions"),
    findAllNoCache("Product_Variants"),
    findAllNoCache("Product_Price_History"),
  ]);
  const r = replayOrders(orders as any[], lines as any[], promotions as any[]);

  console.log(`${r.badLines} lệch trên ${r.lineCount} dòng (${r.orderNos.length} đơn, trên ${r.orderCount} đơn)`);
  for (const no of r.orderNos) console.log(`  đơn ${no}`);
  for (const d of r.diffs) console.log(`  ${d.order_no} dòng ${d.line_no} ${d.field}: lưu ${d.stored}, tính lại ${d.computed}`);

  const h = checkHistoryMatchesPrice(variants as any[], history as any[]);
  console.log(`${h.mismatches.length} cỡ món có giá khác dòng lịch sử giá cuối, trên ${h.checked} cỡ món`);
  for (const m of h.mismatches) console.log(`  ${m.variant_id}: giá ${m.price}, lịch sử ${m.historyPrice ?? "không có dòng"}`);
  if (h.mismatches.length > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
