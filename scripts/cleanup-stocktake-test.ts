import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

/**
 * Owner directive 2026-08-09: the apply_stocktake_session_atomic write path
 * (migrations 0055/0059) has only ever run inside BEGIN...ROLLBACK
 * verification transactions -- stock_issues has been empty as a matter of
 * principle the whole time. The owner's own real stocktake count is about to
 * be the first real exercise of it, and a test count is going to precede it.
 * This script is written now, BEFORE that test count exists, so cleanup is
 * ready the moment it is needed. Per the owner: write it, report it, do not
 * run it -- not even dry-run -- until told to.
 *
 * Two independent jobs, run together in one pass:
 *
 * (a) One test stocktake session, identified by --session=STK-XXX at run
 *     time (it does not exist yet -- it will be created by the owner's own
 *     test count and confirm, after this script is written).
 * (b) Five real, already-CANCELLED sessions left over from before the
 *     issue-based flow existed: STK-001..005.
 *
 * Both jobs delete the same three things for a session, in the same order,
 * for the same reason (see cleanupSession below): stock_issues rows, then
 * stock_ledger STOCK_ADJUST rows, then the session itself (which cascades
 * its stocktake_lines).
 *
 * Triggers checked before writing anything, per fnbapp-bulk-data-change:
 *
 * - stock_ledger: trg_stock_ledger_inventory_balances, AFTER INSERT OR
 *   DELETE OR UPDATE OF item_reference, quantity_change. On DELETE it runs
 *   inventory_balances.quantity += -old.quantity_change for the deleted
 *   row's item_reference -- deleting a STOCK_ADJUST row undoes exactly the
 *   correction it applied. This is the mechanism the owner named directly
 *   ("trg_stock_ledger_inventory_balances tự cộng trả lại") and the same one
 *   Plan C Task 5 relied on for its own stock_ledger deletion
 *   (scripts/delete-derived-stock-rows.ts). This script never touches
 *   inventory_balances by hand.
 * - stock_issues: no triggers (0052_stock_issues.sql). Its session_id column
 *   is `references public.stocktake_sessions(id)` with no ON DELETE clause
 *   -- default NO ACTION. A stock_issues row for a session must be deleted
 *   BEFORE that session row, or the session delete fails on the FK. This is
 *   why stock_issues is deleted first below, not stock_ledger or the
 *   session.
 *
 * COMPENSATING ROWS -- added 2026-08-09 after D14 shipped. If the target
 * session was reversed via reverse_stocktake_session_atomic (migration
 * 0062) before this script runs, it now has, for the SAME session_id /
 * reference_id: the original stock_issues/stock_ledger rows AND their
 * compensating reversal rows. Checked deliberately, not assumed: 0062 tags
 * every compensating row with the ORIGINAL session's session_id/
 * reference_id (never null, never a different id), so this script's
 * existing filter (session_id = X for stock_issues, reference_id = X for
 * stock_ledger) already catches both -- correct, since deleting both an
 * original STOCK_ADJUST row (+X) and its compensating one (-X) via the same
 * trigger leaves inventory_balances exactly where it was before either
 * existed (each delete undoes its own row's contribution; +X and -X cancel
 * regardless of order).
 *
 * One real ordering hazard this uncovered: a compensating stock_issues row
 * carries reverses_issue_id pointing at the original row's id (0058's
 * self-referencing FK on stock_issues, also with no ON DELETE clause --
 * NO ACTION). Deleting the original before its compensating row, if
 * Postgres ever checked that FK before the whole statement finished, would
 * violate it. Not relying on statement-level check timing either way --
 * stock_issues is deleted in two explicit passes below: compensating rows
 * (reverses_issue_id is not null) first, then originals second. Safe
 * regardless of how that timing actually works.
 * - stocktake_lines: no triggers. session_id is `references
 *   stocktake_sessions(id) on delete cascade` (0036_stocktake_sessions.sql)
 *   -- deleting a session deletes its lines automatically. Never deleted
 *   directly by this script.
 * - stocktake_sessions: trg_stocktake_sessions_touch, BEFORE UPDATE (sets
 *   updated_at). Irrelevant here -- this script only deletes sessions, never
 *   updates one.
 *
 * STK-003 EXCEPTION -- read this before treating it as precedent:
 * D12 (migration 0061, cancel_stocktake_session_atomic) keeps any session
 * with at least one counted line, on the theory that a real human count is
 * evidence worth keeping even if the session was abandoned. STK-003 has
 * exactly one counted line, so under D12's own rule it would normally be
 * kept. It is deleted here anyway, as a deliberate, named exception: that
 * one line was written by this session's own "Verify D5 script" activity
 * while confirming the D5 apply path, not by a person standing in front of
 * the shelf. It carries no real count to lose. Do not read this deletion as
 * D12's rule being wrong or as license to delete other counted sessions --
 * it is an exception for this one row's known origin, nothing more.
 *
 * End state the owner asked this script to prove, printed and self-checked
 * after --apply: stock_issues = 0 rows, stock_ledger = 138 rows,
 * ING-028 balance = 4.100,000000 g exactly, stocktake_sessions = 0 rows.
 *
 * Dry-run by default; --apply writes for real.
 */

const CANCELLED_SESSIONS_TO_DELETE = ["STK-001", "STK-002", "STK-003", "STK-004", "STK-005"];

const EXPECTED_STOCK_LEDGER_COUNT_AFTER = 138;
const ING_028_EXPECTED_QUANTITY_AFTER = 4_100.0;
const ING_028_ITEM_REFERENCE = "ING-028";

interface SessionCleanupPlan {
  sessionId: string;
  sessionExists: boolean;
  sessionStatus: string | null;
  stockIssueRows: Array<{ id: string; purchased_item_id: string; base_quantity: string; issued_at: string; reverses_issue_id: string | null }>;
  stockLedgerRows: Array<{ id: string; item_reference: string; quantity_change: string }>;
  lineCount: number;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const sessionArg = process.argv.find(arg => arg.startsWith("--session="))?.split("=")[1];

  if (!sessionArg) {
    throw new Error(
      "Missing --session=STK-XXX. This is required for part (a) -- the test session " +
        "created by the owner's test count. If there is genuinely no test session to " +
        "clean up yet, this script should not be run at all.",
    );
  }
  if (CANCELLED_SESSIONS_TO_DELETE.includes(sessionArg)) {
    throw new Error(
      `--session=${sessionArg} is already in the hardcoded STK-001..005 list (part b). ` +
        "Part (a) is meant for the new test session, not one of the old cancelled ones.",
    );
  }

  const { getSupabaseClient } = await import("../lib/supabase");
  const { formatNumber } = await import("../lib/format");

  const supabase = getSupabaseClient();

  console.log(`\nMode: ${apply ? "APPLY (writing to production)" : "DRY RUN (no writes)"}`);
  console.log(`Part (a) target session: ${sessionArg}`);
  console.log(`Part (b) target sessions: ${CANCELLED_SESSIONS_TO_DELETE.join(", ")} (STK-003 kept-line exception noted above)`);

  async function buildPlan(sessionId: string): Promise<SessionCleanupPlan> {
    const { data: sessionRow, error: sessionError } = await supabase
      .from("stocktake_sessions")
      .select("id, status")
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError) throw new Error(`stocktake_sessions read failed for ${sessionId}: ${sessionError.message}`);

    const { data: issueRows, error: issueError } = await supabase
      .from("stock_issues")
      .select("id, purchased_item_id, base_quantity, issued_at, reverses_issue_id")
      .eq("session_id", sessionId);
    if (issueError) throw new Error(`stock_issues read failed for ${sessionId}: ${issueError.message}`);

    const { data: ledgerRows, error: ledgerError } = await supabase
      .from("stock_ledger")
      .select("id, item_reference, quantity_change")
      .eq("transaction_type", "STOCK_ADJUST")
      .eq("reference_id", sessionId);
    if (ledgerError) throw new Error(`stock_ledger read failed for ${sessionId}: ${ledgerError.message}`);

    const { count: lineCount, error: lineError } = await supabase
      .from("stocktake_lines")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    if (lineError) throw new Error(`stocktake_lines count failed for ${sessionId}: ${lineError.message}`);

    return {
      sessionId,
      sessionExists: sessionRow != null,
      sessionStatus: sessionRow?.status ?? null,
      stockIssueRows: issueRows ?? [],
      stockLedgerRows: ledgerRows ?? [],
      lineCount: lineCount ?? 0,
    };
  }

  function printPlan(plan: SessionCleanupPlan): void {
    console.log(`\n${plan.sessionId}: ${plan.sessionExists ? `exists, status=${plan.sessionStatus}` : "DOES NOT EXIST"}`);
    console.log(`  stock_issues rows to delete: ${plan.stockIssueRows.length}`);
    for (const r of plan.stockIssueRows) {
      const direction = r.reverses_issue_id ? `compensating, reverses ${r.reverses_issue_id}` : "original";
      console.log(`    ${r.id} purchased_item=${r.purchased_item_id} base_quantity=${r.base_quantity} issued_at=${r.issued_at} (${direction})`);
    }
    console.log(`  stock_ledger STOCK_ADJUST rows to delete: ${plan.stockLedgerRows.length}`);
    for (const r of plan.stockLedgerRows) {
      console.log(`    ${r.id} item_reference=${r.item_reference} quantity_change=${r.quantity_change}`);
    }
    console.log(`  stocktake_lines to cascade-delete with the session: ${plan.lineCount}`);
  }

  console.log("\n--- Part (a): test session ---");
  const partAPlan = await buildPlan(sessionArg);
  printPlan(partAPlan);
  if (!partAPlan.sessionExists) {
    throw new Error(
      `Session ${sessionArg} does not exist. This script must not invent a target -- ` +
        "confirm the correct session id with the owner before running again.",
    );
  }

  console.log("\n--- Part (b): old cancelled sessions ---");
  const partBPlans: SessionCleanupPlan[] = [];
  for (const id of CANCELLED_SESSIONS_TO_DELETE) {
    const plan = await buildPlan(id);
    printPlan(plan);
    if (!plan.sessionExists) {
      throw new Error(`Expected cancelled session ${id} does not exist. Stopping rather than skipping it silently.`);
    }
    if (plan.sessionStatus !== "CANCELLED") {
      throw new Error(`${id} has status=${plan.sessionStatus}, expected CANCELLED. Stopping -- this is not the session D12 described.`);
    }
    partBPlans.push(plan);
  }

  if (!apply) {
    console.log("\nDry run only -- no data written. Re-run with --apply to write these changes.");
    return;
  }

  const failures: string[] = [];

  async function deleteSession(plan: SessionCleanupPlan): Promise<void> {
    console.log(`\nDeleting for ${plan.sessionId}...`);

    if (plan.stockIssueRows.length > 0) {
      // Two passes: compensating rows (reverses_issue_id set) before
      // originals, so a compensating row's self-referencing FK
      // (stock_issues.reverses_issue_id -> stock_issues.id, no ON DELETE
      // clause) never points at an already-deleted row -- see the header
      // comment. supabase-js .not("reverses_issue_id", "is", null) is the
      // "IS NOT NULL" form.
      const { error: compError, count: compCount } = await supabase
        .from("stock_issues")
        .delete({ count: "exact" })
        .eq("session_id", plan.sessionId)
        .not("reverses_issue_id", "is", null);
      if (compError) throw new Error(`stock_issues (compensating) delete failed for ${plan.sessionId}: ${compError.message}`);

      const { error: origError, count: origCount } = await supabase
        .from("stock_issues")
        .delete({ count: "exact" })
        .eq("session_id", plan.sessionId)
        .is("reverses_issue_id", null);
      if (origError) throw new Error(`stock_issues (original) delete failed for ${plan.sessionId}: ${origError.message}`);

      const totalDeleted = (compCount ?? 0) + (origCount ?? 0);
      console.log(`  stock_issues deleted: ${totalDeleted} (${compCount ?? 0} compensating, ${origCount ?? 0} original; expected ${plan.stockIssueRows.length})`);
      if (totalDeleted !== plan.stockIssueRows.length) {
        failures.push(`${plan.sessionId}: stock_issues delete count ${totalDeleted}, expected ${plan.stockIssueRows.length}.`);
      }
    }

    if (plan.stockLedgerRows.length > 0) {
      const { error, count } = await supabase
        .from("stock_ledger")
        .delete({ count: "exact" })
        .eq("transaction_type", "STOCK_ADJUST")
        .eq("reference_id", plan.sessionId);
      if (error) throw new Error(`stock_ledger delete failed for ${plan.sessionId}: ${error.message}`);
      console.log(`  stock_ledger deleted: ${count} (expected ${plan.stockLedgerRows.length})`);
      if (count !== plan.stockLedgerRows.length) {
        failures.push(`${plan.sessionId}: stock_ledger delete count ${count}, expected ${plan.stockLedgerRows.length}.`);
      }
    }

    const { error: sessionDeleteError, count: sessionDeleteCount } = await supabase
      .from("stocktake_sessions")
      .delete({ count: "exact" })
      .eq("id", plan.sessionId);
    if (sessionDeleteError) throw new Error(`stocktake_sessions delete failed for ${plan.sessionId}: ${sessionDeleteError.message}`);
    console.log(`  stocktake_sessions deleted: ${sessionDeleteCount} (expected 1, cascades ${plan.lineCount} lines)`);
    if (sessionDeleteCount !== 1) {
      failures.push(`${plan.sessionId}: stocktake_sessions delete count ${sessionDeleteCount}, expected 1.`);
    }
  }

  await deleteSession(partAPlan);
  for (const plan of partBPlans) {
    await deleteSession(plan);
  }

  console.log("\nRe-reading end state...");

  const { count: stockIssuesAfter, error: stockIssuesAfterError } = await supabase
    .from("stock_issues")
    .select("id", { count: "exact", head: true });
  if (stockIssuesAfterError) throw new Error(`stock_issues recount failed: ${stockIssuesAfterError.message}`);
  console.log(`  stock_issues total rows: ${stockIssuesAfter} (expected 0)`);
  if ((stockIssuesAfter ?? 0) !== 0) failures.push(`stock_issues has ${stockIssuesAfter} rows remaining, expected 0.`);

  const { count: stockLedgerAfter, error: stockLedgerAfterError } = await supabase
    .from("stock_ledger")
    .select("id", { count: "exact", head: true });
  if (stockLedgerAfterError) throw new Error(`stock_ledger recount failed: ${stockLedgerAfterError.message}`);
  console.log(`  stock_ledger total rows: ${stockLedgerAfter} (expected ${EXPECTED_STOCK_LEDGER_COUNT_AFTER})`);
  if (stockLedgerAfter !== EXPECTED_STOCK_LEDGER_COUNT_AFTER) {
    failures.push(`stock_ledger has ${stockLedgerAfter} rows, expected ${EXPECTED_STOCK_LEDGER_COUNT_AFTER}.`);
  }

  const { data: ing028Name } = await supabase.from("base_ingredients").select("name").eq("id", ING_028_ITEM_REFERENCE).maybeSingle();
  const { data: ing028Balance, error: ing028Error } = await supabase
    .from("inventory_balances")
    .select("quantity")
    .eq("item_reference", ING_028_ITEM_REFERENCE)
    .maybeSingle();
  if (ing028Error) throw new Error(`inventory_balances read failed for ${ING_028_ITEM_REFERENCE}: ${ing028Error.message}`);
  const ing028Quantity = Number(ing028Balance?.quantity ?? 0);
  console.log(
    `  ${ing028Name?.name ?? ING_028_ITEM_REFERENCE} (${ING_028_ITEM_REFERENCE}): ${formatNumber(ing028Quantity, { withDecimals: true })} ` +
      `(expected ${formatNumber(ING_028_EXPECTED_QUANTITY_AFTER, { withDecimals: true })})`,
  );
  if (Math.abs(ing028Quantity - ING_028_EXPECTED_QUANTITY_AFTER) >= 0.000001) {
    failures.push(`${ING_028_ITEM_REFERENCE} balance is ${ing028Quantity}, expected ${ING_028_EXPECTED_QUANTITY_AFTER}.`);
  }

  const { count: sessionsAfter, error: sessionsAfterError } = await supabase
    .from("stocktake_sessions")
    .select("id", { count: "exact", head: true });
  if (sessionsAfterError) throw new Error(`stocktake_sessions recount failed: ${sessionsAfterError.message}`);
  console.log(`  stocktake_sessions total rows: ${sessionsAfter} (expected 0)`);
  if ((sessionsAfter ?? 0) !== 0) failures.push(`stocktake_sessions has ${sessionsAfter} rows remaining, expected 0.`);

  if (failures.length > 0) {
    console.log(`\nCLEANUP FAILED VERIFICATION -- do not treat as done. ${failures.length} check(s) failed:`);
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  } else {
    console.log("\nAll post-write checks passed.");
  }
}

main().catch(err => {
  console.error("FATAL:", err);
  process.exitCode = 1;
});
