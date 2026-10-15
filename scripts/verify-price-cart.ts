import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Replay of priceCart over every order, every status (spec 2026-10-15, section 5).
 * Read-only. Run: npx vite-node scripts/verify-price-cart.ts
 * Expected: only order 260618001003 differs (3,000 promotion money, no promotion recorded).
 */
async function main(): Promise<void> {
  const { findAllNoCache } = await import("@/lib/db/tables");
  const { replayOrders } = await import("./verify-price-cart-core");

  const [orders, lines, promotions] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Promotions"),
  ]);
  const r = replayOrders(orders as any[], lines as any[], promotions as any[]);

  console.log(`${r.badLines} lệch trên ${r.lineCount} dòng (${r.orderNos.length} đơn, trên ${r.orderCount} đơn)`);
  for (const no of r.orderNos) console.log(`  đơn ${no}`);
  for (const d of r.diffs) console.log(`  ${d.order_no} dòng ${d.line_no} ${d.field}: lưu ${d.stored}, tính lại ${d.computed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
