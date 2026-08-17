import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * OPEN-ITEMS 41 follow-up. Owner-confirmed fact, 2026-08-17: one hop of
 * "Sua chua khong duong Vinamilk" is 100 GRAMS.
 *
 * uom_conversions row QD-049 (purchased_item_id SPM-043, status ACTIVE, the
 * item's only conversion) has base_unit = U-003 ("ml"). Its own base
 * ingredient, ING-032 "Sua chua khong duong", has base_unit = UNT-017 ("g"),
 * and every one of the 15 purchase_order_lines written against this
 * conversion independently recorded base_unit "g" (e.g. 18 hop -> 1.800,
 * 48 hop -> 4.800 -- consistent with 100 per hop under either label). The
 * conversion row's own base_unit looks like a data-entry mistake from
 * 2026-06-28 (created_at == updated_at, never edited since). This script
 * corrects that one column on that one row: U-003 -> UNT-017. conversion_rate
 * (100) is UNCHANGED -- this is a label correction, not a reinterpretation of
 * any historical quantity.
 *
 * Triggers, checked live 2026-08-17 via pg_get_triggerdef, not assumed:
 *   uom_conversions: exactly one, trg_uom_conversions_touch (BEFORE UPDATE),
 *     whose entire function body (read via pg_get_functiondef) is
 *     `new.updated_at = now(); return new;`. No queue writes, nothing
 *     downstream reads a table this trigger touches beyond updated_at.
 *
 * Why this bypasses app/admin/inventory/conversions/actions.ts's own guard
 * (updateConversion, :153-161) and app/admin/inventory/items/actions.ts's
 * matching guard (:144-151) rather than going through the UI: both refuse to
 * change a referenced conversion's base_unit (among other core fields) at
 * all, since QD-049 is referenced by 15 purchase_order_lines. That guard
 * exists because changing conversion_rate or purchased_unit would
 * reinterpret what a historical purchase quantity meant. Verified live
 * 2026-08-17 that base_unit itself carries no such weight before writing
 * this script: grepped every read of uom_conversions.base_unit across app/
 * and lib/ (issue-slips/actions.ts:56+97-105, stocktake/actions.ts:103,
 * reports/issued/actions.ts:75, conversions/actions.ts:157,
 * items/actions.ts:147) plus every arithmetic path that touches a
 * purchased-item quantity (lib/purchased-item-onhand.ts,
 * lib/stocktake-package-lines.ts, lib/purchase-order-write-plan.ts,
 * lib/reorder-suggestion.ts). Every arithmetic path (base_quantity,
 * conversionRate, onHand) reads conversion_rate only, never base_unit.
 * base_unit is read only for two purposes: (a) a display label, formatted
 * into a string or shown verbatim -- issue-slips, stocktake, reports/issued;
 * (b) old-value-vs-new-form-value CHANGE DETECTION in the two edit guards
 * above, comparing the conversion's own base_unit before and after an edit
 * attempt, never comparing it against the ingredient's base_unit. No
 * unit-compatibility check and no arithmetic anywhere depends on whether
 * uom_conversions.base_unit agrees with its ingredient's base_unit -- so
 * correcting the mismatch changes no computed number, only a label.
 *
 * Dry-run by default; --apply writes for real. The owner approves --apply.
 */

const CONVERSION_ID = "QD-049";
const PURCHASED_ITEM_ID = "SPM-043";
const EXPECTED_OLD_BASE_UNIT = "U-003"; // "ml"
const NEW_BASE_UNIT = "UNT-017"; // "g"
const EXPECTED_CONVERSION_RATE = 100;
const EXPECTED_PO_LINE_COUNT = 15;
const EXPECTED_PO_LINE_BASE_QTY_TOTAL = 37800;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Target: uom_conversions row ${CONVERSION_ID} (purchased_item_id ${PURCHASED_ITEM_ID})`);

  const { data: rows, error: readErr } = await supabase
    .from("uom_conversions")
    .select("id, purchased_item_id, base_unit, purchased_unit, conversion_rate, status, created_at, updated_at")
    .eq("id", CONVERSION_ID);
  if (readErr) throw new Error(`uom_conversions read failed: ${readErr.message}`);
  if (!rows || rows.length !== 1) {
    throw new Error(`Expected exactly 1 row for id ${CONVERSION_ID}, got ${rows?.length ?? 0}. Stop -- do not write.`);
  }
  const before = rows[0] as any;
  console.log("\nCurrent row (before):");
  console.log(before);

  // Re-verify every fact this correction depends on before writing anything
  // -- if any of these have changed since this script was written, the
  // correction is no longer justified as described.
  if (before.purchased_item_id !== PURCHASED_ITEM_ID) {
    throw new Error(`purchased_item_id mismatch: expected ${PURCHASED_ITEM_ID}, got ${before.purchased_item_id}. Stop.`);
  }
  if (before.base_unit !== EXPECTED_OLD_BASE_UNIT) {
    throw new Error(
      `base_unit is already ${before.base_unit}, not the expected ${EXPECTED_OLD_BASE_UNIT} -- ` +
        `either already corrected or changed for another reason. Stop, do not write.`,
    );
  }
  if (before.status !== "ACTIVE") {
    throw new Error(`status mismatch: expected ACTIVE, got ${before.status}. Stop.`);
  }
  if (Number(before.conversion_rate) !== EXPECTED_CONVERSION_RATE) {
    throw new Error(
      `conversion_rate mismatch: expected ${EXPECTED_CONVERSION_RATE}, got ${before.conversion_rate}. Stop -- ` +
        `this script only ever changes base_unit, and refuses to run if the rate has moved.`,
    );
  }

  const { data: ingredientRows, error: ingErr } = await supabase
    .from("base_ingredients")
    .select("id, base_unit")
    .eq("id", "ING-032");
  if (ingErr) throw new Error(`base_ingredients read failed: ${ingErr.message}`);
  const ingredientBaseUnit = ingredientRows?.[0]?.base_unit;
  console.log(`\nING-032 base_unit (live): ${ingredientBaseUnit}`);
  if (ingredientBaseUnit !== NEW_BASE_UNIT) {
    throw new Error(
      `ING-032's own base_unit is ${ingredientBaseUnit}, not the expected ${NEW_BASE_UNIT} -- ` +
        `the justification for this correction no longer holds. Stop, do not write.`,
    );
  }

  const { count: poLineCount, error: poCountErr } = await supabase
    .from("purchase_order_lines")
    .select("id", { count: "exact", head: true })
    .eq("conversion_id", CONVERSION_ID);
  if (poCountErr) throw new Error(`purchase_order_lines count failed: ${poCountErr.message}`);
  console.log(`purchase_order_lines referencing ${CONVERSION_ID}: ${poLineCount}`);
  if (poLineCount !== EXPECTED_PO_LINE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_PO_LINE_COUNT} purchase_order_lines referencing ${CONVERSION_ID}, found ${poLineCount}. Stop.`,
    );
  }

  const { data: poLines, error: poReadErr } = await supabase
    .from("purchase_order_lines")
    .select("base_quantity")
    .eq("conversion_id", CONVERSION_ID);
  if (poReadErr) throw new Error(`purchase_order_lines read failed: ${poReadErr.message}`);
  const baseQtyTotal = (poLines || []).reduce((sum: number, l: any) => sum + Number(l.base_quantity), 0);
  console.log(`purchase_order_lines base_quantity total: ${baseQtyTotal}`);
  if (baseQtyTotal !== EXPECTED_PO_LINE_BASE_QTY_TOTAL) {
    throw new Error(
      `base_quantity total mismatch: expected ${EXPECTED_PO_LINE_BASE_QTY_TOTAL}, got ${baseQtyTotal}. Stop.`,
    );
  }

  const after = { ...before, base_unit: NEW_BASE_UNIT };
  console.log("\n--- Row after (base_unit only column changed) ---");
  console.log(after);
  console.log("(fires trg_uom_conversions_touch -- entire effect beyond base_unit is updated_at)");

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write this change.");
    return;
  }

  console.log("\nUpdating uom_conversions.base_unit...");
  const { error: updateErr } = await supabase
    .from("uom_conversions")
    .update({ base_unit: NEW_BASE_UNIT })
    .eq("id", CONVERSION_ID);
  if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

  const { data: verifyRows, error: verifyErr } = await supabase
    .from("uom_conversions")
    .select("id, purchased_item_id, base_unit, purchased_unit, conversion_rate, status, updated_at")
    .eq("id", CONVERSION_ID);
  if (verifyErr) throw new Error(`Post-write read failed: ${verifyErr.message}`);
  console.log("\nRow after write (re-read):");
  console.log(verifyRows?.[0]);
  if (verifyRows?.[0]?.base_unit !== NEW_BASE_UNIT) {
    throw new Error(`Post-write verification failed: base_unit is ${verifyRows?.[0]?.base_unit}, expected ${NEW_BASE_UNIT}.`);
  }

  console.log("\nDone. Only uom_conversions.base_unit and updated_at changed on this one row.");
}

main().catch(err => {
  console.error("\nFAILED:", err.message ?? err);
  process.exit(1);
});
