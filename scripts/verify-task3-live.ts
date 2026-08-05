import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

async function ledgerCount(): Promise<number> {
  const { findAll } = await import("../lib/sheets_db");
  return (await findAll("Stock_Ledger") as any[]).length;
}

async function main(): Promise<void> {
  const { submitOrderV2 } = await import("../app/pos/actions");
  const { editOrderV2, voidOrderV2 } = await import("../app/admin/orders/actions");
  const { saveProductionOrder } = await import("../app/admin/production/actions");
  const { findAllWhere } = await import("../lib/sheets_db");

  console.log("=== Task 3 live verification -- real writes, run once ===\n");

  // ---- 1) POS sale: 1x Ca phe da (PROD-001 / VAR-001, brand BR-001) ----
  const before1 = await ledgerCount();
  console.log(`[1/3] POS sale -- stock_ledger before: ${before1}`);

  const cart = {
    brand_id: "BR-001",
    items: [
      {
        product_id: "PROD-001",
        variant_id: "VAR-001",
        qty: 1,
        modifiers: [],
        manual_item_discount: { value: 0, type: "VND" as const },
      },
    ],
    payment_method: "CASH" as const,
    actor: { id: "system", name: "Task 3 verification" },
  };

  const saleResult = await submitOrderV2(cart, `task3-verify-${Date.now()}`);
  if (!saleResult.success) throw new Error(`POS sale failed: ${saleResult.error}`);
  console.log(`  order created: ${saleResult.order_id} (${saleResult.order_no})`);

  const after1 = await ledgerCount();
  console.log(`  stock_ledger after:  ${after1}`);
  console.log(`  RESULT: ${after1 === before1 ? "EQUAL (pass)" : "MISMATCH (FAIL)"}\n`);

  const newLines = await findAllWhere<any>("Order_Lines_V2", { eq: { order_id: saleResult.order_id } });
  console.log(`  cost_at_sale on the new line: ${newLines[0]?.cost_at_sale}`);

  // ---- 2) Edit that same order (fresh, zero pre-existing ledger rows) ----
  const before2 = await ledgerCount();
  console.log(`[2/3] Edit that order -- stock_ledger before: ${before2}`);

  const editResult = await editOrderV2({
    orderId: saleResult.order_id,
    expectedVersion: 1,
    cart,
    reason: "Task 3 live verification -- no content change, testing the edit write path",
  });
  if (!editResult.success) throw new Error(`Edit failed: ${editResult.error}`);
  console.log(`  new version: ${editResult.new_order_id} (v${editResult.new_version})`);

  const after2 = await ledgerCount();
  console.log(`  stock_ledger after:  ${after2}`);
  console.log(`  RESULT: ${after2 === before2 ? "EQUAL (pass)" : "MISMATCH (FAIL)"}\n`);

  // ---- 3) Attempt a production batch -- must be refused, must write nothing ----
  const before3 = await ledgerCount();
  console.log(`[3/3] Production attempt -- stock_ledger before: ${before3}`);

  const formData = new FormData();
  formData.set("semi_product_id", "BTP-009");
  formData.set("target_yield", "100");
  formData.set("consumed_ingredients", JSON.stringify([
    { ingredient_id: "ING-015", ingredient_type: "BASE_INGREDIENT", unit_id: "", qtyNeeded: 10, is_non_inventory: false },
  ]));

  const prodResult = await saveProductionOrder(formData);
  console.log(`  result: ${JSON.stringify(prodResult)}`);

  const after3 = await ledgerCount();
  console.log(`  stock_ledger after:  ${after3}`);
  console.log(`  RESULT: ${after3 === before3 ? "EQUAL (pass)" : "MISMATCH (FAIL)"}\n`);

  // ---- Cleanup: void the test order so it has zero effect on real reports ----
  console.log("Cleanup: voiding the test order...");
  const beforeVoid = await ledgerCount();
  const voidResult = await voidOrderV2(editResult.new_order_id, "Task 3 live verification -- cleanup");
  console.log(`  void result: ${JSON.stringify(voidResult)}`);
  const afterVoid = await ledgerCount();
  console.log(`  stock_ledger before void: ${beforeVoid}, after void: ${afterVoid} (expected equal -- new version also has zero ledger rows to reverse)`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
