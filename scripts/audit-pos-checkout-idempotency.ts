import * as dotenv from "dotenv";
import { summarizePosCheckoutRequestIds } from "../lib/pos-checkout-idempotency";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function main(): Promise<void> {
  const { findAllNoCache } = await import("../lib/sheets_db");
  const orders = await findAllNoCache("Orders_V2");
  const summary = summarizePosCheckoutRequestIds(orders);

  console.log("=== POS CHECKOUT IDEMPOTENCY AUDIT (READ ONLY) ===");
  console.log(`Orders:                         ${summary.totalOrders}`);
  console.log(`Orders with client request ID:  ${summary.ordersWithRequestId}`);
  console.log(`Legacy orders without one:      ${summary.legacyOrdersWithoutRequestId}`);
  console.log(`Duplicate client request IDs:   ${summary.duplicateRequestIds.length}`);

  for (const duplicate of summary.duplicateRequestIds.slice(0, 20)) {
    console.log(`${duplicate.requestId}: ${duplicate.orderIds.join(", ")}`);
  }

  console.log("No data was written.");
  if (summary.duplicateRequestIds.length > 0) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
