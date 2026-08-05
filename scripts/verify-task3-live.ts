/**
 * Live proof that Plan C Task 3 holds against the real database: selling,
 * editing, and attempting a production batch must leave stock_ledger's row
 * count unchanged. Dry-run by default (CLAUDE.md section 2); --apply writes
 * one real sale, edits it once, attempts one refused production batch, then
 * voids the edited order so nothing countable is left behind.
 *
 * Keep this script -- it is the only proof of "selling does not touch the
 * ledger" against production data, and Task 5 will want it run again.
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const APPLY = process.argv.includes("--apply");

const TEST_BRAND_ID = "BR-001";
const TEST_PRODUCT_ID = "PROD-001";
const TEST_VARIANT_ID = "VAR-001";
const TEST_SEMI_PRODUCT_ID = "BTP-009";

async function ledgerCount(): Promise<number> {
  const { findAll } = await import("../lib/sheets_db");
  return (await findAll("Stock_Ledger") as any[]).length;
}

async function describeTargets() {
  const { findAll } = await import("../lib/sheets_db");
  const [products, variants, semiProducts] = await Promise.all([
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Semi_Products"),
  ]);
  const product = (products as any[]).find(p => p.id === TEST_PRODUCT_ID);
  const variant = (variants as any[]).find(v => v.id === TEST_VARIANT_ID);
  const semiProduct = (semiProducts as any[]).find(s => s.id === TEST_SEMI_PRODUCT_ID);
  return { product, variant, semiProduct };
}

async function dryRun(): Promise<void> {
  const { product, variant, semiProduct } = await describeTargets();
  const before = await ledgerCount();

  console.log("=== Task 3 live verification -- DRY RUN (default; nothing is written) ===\n");
  console.log(`stock_ledger right now: ${before} rows\n`);
  console.log(`[1/3] Would ring up one real sale: 1x "${product?.name}" (${variant?.size_name}, ${TEST_VARIANT_ID}), brand ${TEST_BRAND_ID}.`);
  console.log(`      Would then count stock_ledger and expect it still ${before}.\n`);
  console.log(`[2/3] Would edit that same order once (no content change -- proves the edit path writes nothing).`);
  console.log(`      Would then count stock_ledger and expect it still ${before}.\n`);
  console.log(`[3/3] Would attempt one production batch: "${semiProduct?.name}" (${TEST_SEMI_PRODUCT_ID}), expecting refusal per BR-INV-006.`);
  console.log(`      Would then count stock_ledger and expect it still ${before}.\n`);
  console.log("Would then void the edited order and print its final status (SUPERSEDED / VOIDED).\n");
  console.log("Nothing written. Run with --apply to actually create these three real transactions.");
}

async function apply(): Promise<void> {
  const { product, variant, semiProduct } = await describeTargets();
  const { submitOrderV2 } = await import("../app/pos/actions");
  const { editOrderV2, voidOrderV2 } = await import("../app/admin/orders/actions");
  const { saveProductionOrder } = await import("../app/admin/production/actions");
  const { findAllWhere, findById } = await import("../lib/sheets_db");

  console.log("=== Task 3 live verification -- APPLY (writing real data) ===\n");

  // ---- 1) POS sale ----
  const before1 = await ledgerCount();
  console.log(`[1/3] POS sale -- writing 1x "${product?.name}" (${variant?.size_name}) -- stock_ledger before: ${before1}`);

  const cart = {
    brand_id: TEST_BRAND_ID,
    items: [
      {
        product_id: TEST_PRODUCT_ID,
        variant_id: TEST_VARIANT_ID,
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
  console.log(`  WROTE order ${saleResult.order_id} (${saleResult.order_no}) -- "${product?.name}"`);

  const after1 = await ledgerCount();
  console.log(`  stock_ledger after:  ${after1}`);
  console.log(`  RESULT: ${after1 === before1 ? "EQUAL (pass)" : "MISMATCH (FAIL)"}\n`);

  const newLines = await findAllWhere<any>("Order_Lines_V2", { eq: { order_id: saleResult.order_id } });
  console.log(`  cost_at_sale on the new line: ${newLines[0]?.cost_at_sale}`);

  // ---- 2) Edit that same order (fresh, zero pre-existing ledger rows) ----
  const before2 = await ledgerCount();
  console.log(`[2/3] Edit order ${saleResult.order_id} -- stock_ledger before: ${before2}`);

  const editResult = await editOrderV2({
    orderId: saleResult.order_id,
    expectedVersion: 1,
    cart,
    reason: "Task 3 live verification -- no content change, testing the edit write path",
  });
  if (!editResult.success) throw new Error(`Edit failed: ${editResult.error}`);
  console.log(`  WROTE new version ${editResult.new_order_id} (v${editResult.new_version})`);

  const after2 = await ledgerCount();
  console.log(`  stock_ledger after:  ${after2}`);
  console.log(`  RESULT: ${after2 === before2 ? "EQUAL (pass)" : "MISMATCH (FAIL)"}\n`);

  // ---- 3) Attempt a production batch -- must be refused, must write nothing ----
  const before3 = await ledgerCount();
  console.log(`[3/3] Production attempt -- "${semiProduct?.name}" (${TEST_SEMI_PRODUCT_ID}) -- stock_ledger before: ${before3}`);

  const formData = new FormData();
  formData.set("semi_product_id", TEST_SEMI_PRODUCT_ID);
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
  console.log(`Cleanup: voiding ${editResult.new_order_id}...`);
  const beforeVoid = await ledgerCount();
  const voidResult = await voidOrderV2(editResult.new_order_id, "Task 3 live verification -- cleanup");
  console.log(`  void result: ${JSON.stringify(voidResult)}`);
  const afterVoid = await ledgerCount();
  console.log(`  stock_ledger before void: ${beforeVoid}, after void: ${afterVoid} (expected equal -- the edited version also has zero ledger rows to reverse)\n`);

  const originalAfter = await findById("Orders_V2", saleResult.order_id);
  const editedAfter = await findById("Orders_V2", editResult.new_order_id);
  console.log("Final statuses (read back from the database, not assumed):");
  console.log(`  original order ${saleResult.order_id}: ${(originalAfter as any)?.status}`);
  console.log(`  edited order   ${editResult.new_order_id}: ${(editedAfter as any)?.status}`);
  console.log("\nNothing countable was left behind if these read SUPERSEDED and VOIDED.");
}

async function main(): Promise<void> {
  if (APPLY) {
    await apply();
  } else {
    await dryRun();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
