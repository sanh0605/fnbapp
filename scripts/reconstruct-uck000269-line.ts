import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Plan H, task H7 (docs/superpowers/plans/2026-08-14-revenue-audit.md,
 * sections 3 and 5). Owner decision 2026-08-14.
 *
 * Reconstructs the single missing order_lines_v2 row for UCK000269
 * (ord-8ebcdc19-dcc8-4743-a784-399146c365d8), 2026-06-25 -- a real order
 * whose header is correct (gross 18.000d, promo_discount_total 3.000d, net
 * 15.000d, applied_promotion_id PRM-003) but which has zero lines. The
 * owner identified what was sold; every figure below was checked against
 * the data before writing this script, not accepted on trust:
 *   PROD-025 "Tra sua truyen thong" (category CAT-004), sole variant
 *     VAR-032 "700ml", list price 18.000d.
 *   PRM-003 "KHAI TRUONG DONG GIA", type PRODUCT_DISCOUNT, FLAT_PRICE,
 *     ACTIVE, applicable_products_json is the per-variant-map form and
 *     covers VAR-032 at 15.000d specifically (not the promotion's own
 *     top-level discount_value, which is a different number for other
 *     variants -- e.g. VAR-031 maps to 25.000d in the same promotion).
 *   18.000 - 3.000 = 15.000. The money is already right; only the line is
 *   missing.
 *
 * One immaterial discrepancy found while checking, not corrected here
 * because it changes nothing: the plan's prose describes the promotion
 * window as "2026-05-31..2026-06-30"; the stored start_date is
 * "2026-06-01 00:00:00+07" (likely a UTC-vs-Saigon display difference
 * somewhere upstream of the plan text). The order's own date, 2026-06-25,
 * falls inside the promotion window either way, so this does not affect
 * the reconstruction.
 *
 * Triggers, checked live 2026-08-14 against pg_trigger directly (not
 * re-derived from the plan's own summary):
 *   order_lines_v2: zero triggers.
 *   orders_v2: exactly one, trg_orders_v2_touch (BEFORE UPDATE), whose
 *     entire function body (read via pg_get_functiondef, not assumed from
 *     the name) is `new.updated_at = now(); return new;`.
 *   Control: stock_ledger, known to carry a real trigger, was queried the
 *     same way and returned one -- confirming the query method finds
 *     triggers when they exist, so the zero result for order_lines_v2 is
 *     real, not a blind query.
 * Nothing recomputes the header from its lines; this insert and this
 * update have no downstream effect beyond updated_at.
 *
 * Snapshot columns (product_snapshot_json, variant_snapshot_json,
 * modifiers_snapshot_json, recipe_snapshot_json) are all NOT NULL but each
 * has a genuinely empty default ('{}'::jsonb or '[]'::jsonb, confirmed live
 * via information_schema.columns). Amendment 2026-08-14 (H7b), owner
 * decision, after being shown the concrete consequence of leaving
 * product_snapshot_json empty (below): it is now filled, on record here
 * because it is attested, not guessed. The other three stay at their empty
 * default -- deliberately, not an oversight, and the reasons differ per
 * column, not one blanket "leave it empty":
 *
 *   product_snapshot_json -- FILLED. Every order_lines_v2 row ever recorded
 *     for PROD-025 was checked live 2026-08-14, not taken from the plan's
 *     own numbers: 105 lines total (joined to orders_v2.created_at, the real
 *     sale time -- order_lines_v2.created_at on migrated rows instead
 *     records when the V1->V2 migration ran, 2026-06-28, which is NOT when
 *     these sales happened and was caught and discarded as the wrong field
 *     before trusting any date range from it), spanning 2026-06-03 to
 *     2026-08-10, 68 of them inside June 2026. Every single one carries
 *     product_snapshot_json.category_id = CAT-004, category_name = "Trà" --
 *     zero exceptions, so the product never changed category across its
 *     whole recorded history and today's category is not a guess about
 *     June's. The exact shape below was read off three real PROD-025 lines
 *     (newest, not copied from the plan): {"id","name","category_id",
 *     "category_name"}, nothing more.
 *   recipe_snapshot_json -- STAYS EMPTY. This is the one that would
 *     actually corrupt the record: it claims to capture which ingredients,
 *     in what quantities, were consumed at the moment of sale. Nothing
 *     attests to that for this line -- there is no surviving evidence of
 *     what recipe version was effective on 2026-06-25, and fabricating one
 *     would look exactly like a real capture to anyone reading it later.
 *   variant_snapshot_json, modifiers_snapshot_json -- STAY EMPTY. No report
 *     in this codebase reads either for revenue or COGS purposes on this
 *     order; filling them would be decoration with no evidence behind it,
 *     not a correction of a real gap the way product_snapshot_json was.
 *
 * Consequence of the (now-fixed) empty product_snapshot_json, checked
 * before this amendment: app/admin/reports/actions.ts (getPnLDataV2 and
 * getSalesDataV2) reads product_snapshot_json.category_id ONLY when a
 * categoryId filter is applied, to decide which lines belong to that
 * filtered view -- an empty snapshot meant this line would never have
 * appeared in a category-filtered report (e.g. category = CAT-004, this
 * product's own category, filtered to June) -- permanently 15.000d short in
 * that specific view, though every UNFILTERED revenue figure (everything
 * scripts/verify-revenue.ts checks) sums typedOrders.net_total directly,
 * never lines, and was never affected either way.
 *
 * Dry-run by default; --apply writes for real. The owner approves --apply.
 */

const ORDER_ID = "ord-8ebcdc19-dcc8-4743-a784-399146c365d8";
const ORDER_NO = "UCK000269";
const PROMOTION_ID = "PRM-003";
const LINE_ID = "oln-reconstructed-uck000269-line1";

const PRODUCT_SNAPSHOT = {
  id: "PROD-025",
  name: "Trà sữa truyền thống",
  category_id: "CAT-004",
  category_name: "Trà",
};

const MIGRATION_NOTE =
  `[2026-08-14] Line 1 reconstructed from the owner's identification: PROD-025 ` +
  `"Trà sữa truyền thống" / VAR-032 (700ml), qty 1, unit_price 18000, promo ${PROMOTION_ID} ` +
  `(FLAT_PRICE, VAR-032 -> 15000), net_line_total 15000. Verified against VAR-032's list price ` +
  `and ${PROMOTION_ID}'s flat price before writing. product_snapshot_json also reconstructed ` +
  `(H7b, 2026-08-14), on the basis that all 105 order_lines_v2 rows ever recorded for PROD-025 ` +
  `(2026-06-03 to 2026-08-10, 68 in June 2026) carry category_id CAT-004 / "Trà" with zero ` +
  `exceptions -- checked live before writing, not assumed. recipe_snapshot_json, ` +
  `variant_snapshot_json and modifiers_snapshot_json remain empty: nothing attests to their ` +
  `content for this line. See docs/superpowers/plans/2026-08-14-revenue-audit.md section 3.`;

const NEW_LINE: Record<string, unknown> = {
  id: LINE_ID,
  order_id: ORDER_ID,
  line_no: 1,
  product_id: "PROD-025",
  variant_id: "VAR-032",
  qty: 1,
  unit_price: 18000,
  gross_line_total: 18000,
  promo_discount: 3000,
  manual_item_discount: 0,
  order_discount_allocation: 0,
  net_line_total: 15000,
  cost_at_sale: 0,
  promo_discount_reason: `PRM-003 "KHAI TRƯƠNG ĐỒNG GIÁ", FLAT_PRICE, VAR-032 -> 15000đ`,
  product_snapshot_json: PRODUCT_SNAPSHOT,
  // variant_snapshot_json, modifiers_snapshot_json, recipe_snapshot_json
  // deliberately omitted -- column defaults apply. Nothing attests to their
  // content for this line; product_snapshot_json is different because
  // every real PROD-025 line agrees on it with zero exceptions (see the
  // header comment above). Do not "complete" these by analogy.
  // manual_discount_reason omitted -- no manual discount on this line.
};

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getSupabaseClient } = await import("../lib/supabase");
  const supabase = getSupabaseClient();

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Target order: ${ORDER_NO} (${ORDER_ID})`);

  const { data: orderRows, error: orderErr } = await supabase
    .from("orders_v2")
    .select(
      "id, order_no, status, gross_total, promo_discount_total, manual_item_discount_total, manual_order_discount, net_total, applied_promotion_id, migration_notes",
    )
    .eq("id", ORDER_ID);
  if (orderErr) throw new Error(`orders_v2 read failed: ${orderErr.message}`);
  if (!orderRows || orderRows.length !== 1) {
    throw new Error(`Expected exactly 1 order for id ${ORDER_ID}, got ${orderRows?.length ?? 0}. Stop -- do not write.`);
  }
  const order = orderRows[0] as any;
  console.log("\nCurrent order state:");
  console.log(order);

  // Re-verify the exact facts this reconstruction depends on before writing
  // anything -- if any of these have changed since the plan was written,
  // the reconstruction is no longer justified as described.
  if (order.order_no !== ORDER_NO) {
    throw new Error(`order_no mismatch: expected ${ORDER_NO}, got ${order.order_no}. Stop.`);
  }
  if (order.status !== "COMPLETED") {
    throw new Error(`status mismatch: expected COMPLETED, got ${order.status}. Stop.`);
  }
  if (
    Number(order.gross_total) !== 18000 ||
    Number(order.promo_discount_total) !== 3000 ||
    Number(order.manual_item_discount_total) !== 0 ||
    Number(order.manual_order_discount) !== 0 ||
    Number(order.net_total) !== 15000
  ) {
    throw new Error(`Header totals no longer match the plan's description -- stop, do not write.`);
  }
  if (order.applied_promotion_id !== PROMOTION_ID) {
    throw new Error(`applied_promotion_id mismatch: expected ${PROMOTION_ID}, got ${order.applied_promotion_id}. Stop.`);
  }

  const { count: existingLineCount, error: lineCountErr } = await supabase
    .from("order_lines_v2")
    .select("id", { count: "exact", head: true })
    .eq("order_id", ORDER_ID);
  if (lineCountErr) throw new Error(`order_lines_v2 count failed: ${lineCountErr.message}`);
  console.log(`\nExisting lines for this order: ${existingLineCount}.`);
  if (existingLineCount !== 0) {
    throw new Error(
      `Expected 0 existing lines, found ${existingLineCount} -- stop, do not write ` +
        `(the order may already have a line, or this is the wrong target).`,
    );
  }

  // H7b: re-verify live, every run, that product_snapshot_json is still
  // attested -- not just once while writing this script. If PROD-025 ever
  // picks up a line in a different category, that category assignment is no
  // longer uniform across its history and this snapshot needs re-justifying
  // before writing it again.
  const { data: prodLines, error: prodLinesErr } = await supabase
    .from("order_lines_v2")
    .select("product_snapshot_json")
    .eq("product_id", "PROD-025");
  if (prodLinesErr) throw new Error(`PROD-025 line read failed: ${prodLinesErr.message}`);
  const categories = new Set(
    (prodLines || []).map((l: any) => JSON.stringify({
      category_id: l.product_snapshot_json?.category_id,
      category_name: l.product_snapshot_json?.category_name,
    })),
  );
  console.log(
    `\nPROD-025 category check: ${prodLines?.length ?? 0} existing lines, ${categories.size} distinct category value(s).`,
  );
  if (categories.size !== 1 || ![...categories][0].includes("CAT-004")) {
    throw new Error(
      `PROD-025's recorded category is no longer uniformly CAT-004/"Trà" across its ${prodLines?.length ?? 0} lines ` +
        `(${categories.size} distinct value(s) found) -- stop, do not write. The product may have moved category, ` +
        `and today's value is not necessarily what June's was.`,
    );
  }

  const newMigrationNotes = order.migration_notes
    ? `${order.migration_notes}\n${MIGRATION_NOTE}`
    : MIGRATION_NOTE;

  console.log("\n--- Row to insert into order_lines_v2 ---");
  console.log(NEW_LINE);
  console.log("\n--- Update to orders_v2.migration_notes (no other column touched) ---");
  console.log(`Current: ${JSON.stringify(order.migration_notes)}`);
  console.log(`New:     ${JSON.stringify(newMigrationNotes)}`);
  console.log("(fires trg_orders_v2_touch -- entire effect is updated_at)");

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  console.log("\nInserting line...");
  const { error: insertErr } = await supabase.from("order_lines_v2").insert(NEW_LINE);
  if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

  console.log("Updating orders_v2.migration_notes...");
  const { error: updateErr } = await supabase
    .from("orders_v2")
    .update({ migration_notes: newMigrationNotes })
    .eq("id", ORDER_ID);
  if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);

  console.log("\nRe-reading end state...");
  const { data: verifyLine, error: verifyLineErr } = await supabase
    .from("order_lines_v2")
    .select("*")
    .eq("id", LINE_ID)
    .single();
  if (verifyLineErr) throw new Error(`Verify read (line) failed: ${verifyLineErr.message}`);
  console.log("Inserted line:", verifyLine);

  const { data: verifyOrder, error: verifyOrderErr } = await supabase
    .from("orders_v2")
    .select("migration_notes, updated_at")
    .eq("id", ORDER_ID)
    .single();
  if (verifyOrderErr) throw new Error(`Verify read (order) failed: ${verifyOrderErr.message}`);
  console.log("Order after update:", verifyOrder);

  console.log(
    "\nDone. Re-run scripts/verify-revenue.ts to confirm neutrality: check 2 count 2085 -> 2086 (still 0 " +
      "violations), zero-line orders 1 -> 0, every revenue figure unchanged.",
  );
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
