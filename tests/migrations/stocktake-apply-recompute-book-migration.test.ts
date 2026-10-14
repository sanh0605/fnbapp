// tests/migrations/stocktake-apply-recompute-book-migration.test.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raw = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0115_stocktake_confirm_recompute_book.sql"),
  "utf8",
);
const m = raw.toLowerCase();

const open = m.indexOf("$function$", m.indexOf("create or replace function public.apply_stocktake_session_atomic("));
const apply = m.slice(open, m.indexOf("$function$", open + 1));

describe("0115 (BR-INV-017): confirming a stocktake recomputes the book as of each line's count", () => {
  it("keeps the 5-argument signature, sets search_path and locks the function to service_role", () => {
    expect(m).toContain(
      "create or replace function public.apply_stocktake_session_atomic(p_session_id text, p_confirmed_by_id text, p_confirmed_by_name text, p_dry_run boolean default false, p_expected_plan_hash text default null::text)",
    );
    const sig = "public.apply_stocktake_session_atomic(text, text, text, boolean, text)";
    expect(m).toContain(`revoke all on function ${sig} from public, anon, authenticated`);
    expect(m).toContain(`grant execute on function ${sig} to service_role`);
    expect(m).toContain("set search_path to 'public'");
  });

  it("works the book out at the moment of the count from movements dated up to it, not from the frozen figure", () => {
    expect(apply).toContain("counted_at");
    expect(apply).toContain("coalesce(po.transaction_date, po.created_at) <= v_line.counted_at");
    expect(apply).toContain("issued_at, si.issued_at) <= v_line.counted_at");
    // The variance comes from the recomputed book.
    expect(apply).toContain("v_count_variance := v_line.counted_qty - v_book_at_count;");
    expect(apply).not.toContain("v_line.counted_qty - v_line.theoretical_at_count");
    // The all-time sums stay only for the "current" display figure, never for the variance.
    expect(apply).toContain("v_current_theoretical_qty := v_total_purchased - v_total_issued;");
  });

  it("a reversal row (cancelled slip, undone stocktake) counts from its original's date, not from the day it was written", () => {
    expect(apply).toContain("left join public.stock_issues o on o.id = si.reverses_issue_id");
    expect(apply).toContain("coalesce(o.issued_at, si.issued_at) <= v_line.counted_at");
    expect(apply).not.toContain("si.issued_at <= v_line.counted_at");
  });

  it("BR-INV-011: a blank line stays uncounted", () => {
    expect(apply).toContain("and counted_qty is not null");
  });

  it("lists a line whose book changed even when its variance becomes zero (Sữa tươi 10 -> 8 writes nothing)", () => {
    const listed = apply.indexOf("v_recomputed_lines := v_recomputed_lines ||");
    const skip = apply.indexOf("if v_count_variance = 0 then");
    expect(listed).toBeGreaterThan(-1);
    expect(listed).toBeLessThan(skip);
    expect(apply).toContain("'frozen_qty', v_line.theoretical_at_count");
    expect(apply).toContain("'recomputed_qty', v_book_at_count");
    expect(raw).toContain("Sữa tươi");
    expect(raw).toContain("10 -> 8");
  });

  it("stores the recomputed figure on the line at a real confirm only, so a later edit starts from it", () => {
    const upd = apply.indexOf("update public.stocktake_lines set theoretical_at_count = v_book_at_count");
    expect(upd).toBeGreaterThan(-1);
    expect(apply.slice(upd - 120, upd)).toContain("not p_dry_run");
  });

  it("returns recomputed_lines in both the preview and the confirm result, next to the old keys", () => {
    const returnBlocks = apply.match(/return jsonb_build_object\(([\s\S]*?)\);/g) ?? [];
    expect(returnBlocks).toHaveLength(2);
    for (const block of returnBlocks) {
      expect(block).toContain("'recomputed_lines', v_recomputed_lines");
      expect(block).toContain("'ledger_count', v_ledger_count");
      expect(block).toContain("'skipped_ingredients', v_skipped_ingredients");
      expect(block).toContain("'issue_ids', v_issue_ids");
    }
  });

  it("the header names the base migration, the triggers and the deploy order, and adds no table", () => {
    const header = raw.slice(0, raw.indexOf("\ncreate or replace function")).toLowerCase();
    expect(header).toContain("0089");
    expect(header).toContain("stocktake_lines");
    expect(header).toContain("trigger");
    expect(header).toContain("deploy order");
    expect(m).not.toContain("create table");
  });
});
