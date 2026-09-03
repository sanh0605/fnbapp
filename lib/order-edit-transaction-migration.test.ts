import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/0020_atomic_supersede_order.sql"),
  "utf8",
).toLowerCase();

describe("0020 atomic supersede order migration", () => {
  it("locks and checks the old order version before all five writes", () => {
    expect(sql).toContain("function public.supersede_order_v2_atomic");
    expect(sql).toContain("for update");
    expect(sql).toContain("optimistic lock failed");
    expect(sql).toContain("update public.orders_v2");
    expect(sql).toContain("insert into public.orders_v2");
    expect(sql).toContain("insert into public.order_lines_v2");
    expect(sql).toContain("insert into public.order_events");
    expect(sql).toContain("insert into public.stock_ledger");
  });

  it("validates edit relationships and row counts", () => {
    expect(sql).toContain("edit_reversal");
    expect(sql).toContain("sales_consume");
    expect(sql).toContain("line count mismatch");
    expect(sql).toContain("ledger count mismatch");
    expect(sql).toContain("p_event.order_id must match the new order");
  });

  it("limits execution to the service role", () => {
    expect(sql).toContain("from anon");
    expect(sql).toContain("from authenticated");
    expect(sql).toContain("to service_role");
  });
});

// Production defect: 0072 tightened orders_v2.outlet_id to NOT NULL, but
// supersede_order_v2_atomic was last (re)defined in 0046, before that
// column existed -- its insert never named outlet_id, so every edit since
// 0072 landed raises "null value in column \"outlet_id\" ... violates
// not-null constraint". No live Postgres connection is available to this
// session (a direct-connection attempt was blocked earlier this session,
// and the migration itself is deliberately not applied here -- the owner
// approves that separately), so this cannot literally reproduce the
// runtime not-null violation the way a live RPC call would. It proves the
// same fact at the level this repo's own migration tests already operate
// at (0020's suite above): the function's SQL text, not its executed
// behaviour.
//
// extractFunctionBody isolates just this one function's own text from a
// migration file that (unlike 0020) defines several unrelated functions --
// a plain sql.includes("insert into public.orders_v2") on the whole file
// would also match create_pos_order_atomic's insert, which already sets
// outlet_id, and could pass for the wrong reason.
function extractFunctionBody(filePath: string, functionName: string): string {
  const sql = readFileSync(resolve(filePath), "utf8").toLowerCase();
  const startMarker = `create or replace function public.${functionName.toLowerCase()}(`;
  const start = sql.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`${startMarker} not found in ${filePath}`);
  }
  const end = sql.indexOf("$$;", start);
  if (end === -1) {
    throw new Error(`No closing $$; found for ${functionName} in ${filePath}`);
  }
  return sql.slice(start, end);
}

describe("supersede_order_v2_atomic's insert into orders_v2, isolated per migration", () => {
  // The bug itself: 0046 is still the CURRENT, live definition (nothing
  // between it and 0074 redefines this function -- confirmed by grepping
  // every "create or replace function public.supersede_order_v2_atomic"
  // across supabase/migrations/ before writing this test). This assertion
  // fails today on the VALUE -- the string genuinely is not part of that
  // insert's column list, not a missing file or a missing function; 0046
  // exists and defines the function correctly for the schema of the day
  // it was written.
  it("0046 (the definition live in production today) does NOT set outlet_id -- this is the bug", () => {
    const body = extractFunctionBody("supabase/migrations/0046_exact_cost_at_sale.sql", "supersede_order_v2_atomic");
    expect(body).toContain("insert into public.orders_v2");
    expect(body).not.toContain("outlet_id");
  });

  it("0074 (the fix) sources outlet_id from the order being superseded, not from the client payload", () => {
    const body = extractFunctionBody("supabase/migrations/0074_fix_supersede_order_outlet_id.sql", "supersede_order_v2_atomic");
    // Read from the same SELECT that already locks and checks the old
    // row -- not from p_new_order, which is the client's own payload.
    expect(body).toMatch(/select\s+status,\s*version,\s*outlet_id/);
    expect(body).toContain("into v_old_status, v_old_version, v_old_outlet_id");
    expect(body).not.toContain("p_new_order->>'outlet_id'");
    // Present in both the insert's column list and its values.
    expect(body).toMatch(/insert into public\.orders_v2 \(\s*id, order_no, brand_id, outlet_id,/);
    expect(body).toContain("v_old_outlet_id,");
  });
});
