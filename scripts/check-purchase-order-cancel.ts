import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

// Read-only. No writes, no --apply flag exists. Run after migration 0108 is applied:
//   npx vite-node scripts/check-purchase-order-cancel.ts PO-147 PO-064 PO-066
//
// For each order, asks purchase_order_cancel_check (the same function the cancel
// page and the cancel use) and prints "huỷ được" with the assets it would
// retire, or each refusal sentence. Uses the service-role client, the only role
// allowed to execute the check.
// Plan: docs/superpowers/plans/2026-10-05-huy-phieu-nhap.md Task 5.

async function main(): Promise<void> {
  const { parseCheckArgs, runChecks } = await import("./check-purchase-order-cancel-core");
  const { fetchPurchaseOrderCancelCheck, CancelFunctionMissingError } = await import(
    "@/lib/purchasing/purchase-order-cancel-transaction"
  );

  const args = parseCheckArgs(process.argv.slice(2));
  if (args.ok === false) {
    console.error(args.error);
    process.exit(2);
  }

  try {
    // Exit 0 either way: a refusal is an answer, not a failure of the check.
    const { text } = await runChecks(args.ids, fetchPurchaseOrderCancelCheck);
    console.log(text);
  } catch (error) {
    if (error instanceof CancelFunctionMissingError) {
      console.error("Chưa chạy migration 0108 trên máy chủ: chưa có hàm kiểm tra huỷ phiếu.");
      process.exit(1);
    }
    throw error;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
