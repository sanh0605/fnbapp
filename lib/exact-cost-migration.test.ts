import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

const sql = readFileSync("supabase/migrations/0046_exact_cost_at_sale.sql", "utf8");

it("widens order_lines_v2.cost_at_sale to six decimals", () => {
  expect(sql).toMatch(/alter table\s+(public\.)?order_lines_v2/i);
  expect(sql).toMatch(/cost_at_sale\s+type\s+numeric\(18,\s*6\)/i);
});

it("matches the precision stock_ledger already uses", () => {
  const s4 = readFileSync("supabase/migrations/0004_add_stock_ledger_columns.sql", "utf8");
  expect(s4).toContain("numeric(18,6)");
});

describe("0046 Step 4: bigint sweep -- redefines the 7 history-repair RPCs", () => {
  const lowered = sql.toLowerCase();

  const functions = [
    { name: "apply_hong_to_luc_migration", args: "text,\n  text,\n  text,\n  text,\n  jsonb" },
    { name: "supersede_order_v2_atomic", args: "text,\n  integer,\n  jsonb,\n  jsonb default '[]'::jsonb,\n  jsonb default '{}'::jsonb,\n  jsonb default '[]'::jsonb" },
    { name: "apply_mac_drift_recovery", args: "text,\n  text,\n  jsonb,\n  boolean default true" },
    { name: "apply_backdated_event_recovery", args: "uuid,\n  text,\n  jsonb" },
    { name: "apply_backdated_recipe_event_recovery", args: "uuid,\n  text,\n  jsonb" },
    { name: "apply_full_history_recovery", args: "text,\n  text,\n  jsonb,\n  boolean default true" },
    { name: "rebuild_stock_ledger_for_order", args: "text,\n  text,\n  text,\n  integer,\n  jsonb,\n  jsonb,\n  boolean default true" },
  ];

  it.each(functions)("redefines $name", ({ name }) => {
    expect(lowered).toContain(`create or replace function public.${name}(`);
  });

  it("declares no bigint cost variable in any of the 7 functions (v_old_cost/v_new_cost/v_actual_cost/v_total_delta)", () => {
    expect(sql).not.toMatch(/v_old_cost\s+bigint/);
    expect(sql).not.toMatch(/v_new_cost\s+bigint/);
    expect(sql).not.toMatch(/v_actual_cost\s+bigint/);
    expect(sql).not.toMatch(/v_total_delta\s+bigint/);
  });

  it("casts old_cost_at_sale/new_cost_at_sale from jsonb as numeric(18,6), not bigint", () => {
    expect(sql).not.toMatch(/old_cost_at_sale'[^)]*\)::bigint/);
    expect(sql).not.toMatch(/new_cost_at_sale'[^)]*\)::bigint/);
  });

  it("compares line.cost_at_sale against the change log as numeric(18,6), not bigint", () => {
    expect(sql).not.toMatch(/line\.cost_at_sale\s*<>\s*\(change_log\.new_value #>> '\{\}'\)::bigint/);
  });

  it("widens audit_baseline_locks' cost columns to numeric(18,6) (0 rows, lossless)", () => {
    expect(lowered).toMatch(/alter table\s+(public\.)?audit_baseline_locks/);
    expect(lowered).toContain("stored_cost_at_sale type numeric(18, 6)".replace(", 6", ",6"));
  });

  it("does not touch the POS checkout path -- deferred to its own migration", () => {
    expect(lowered).not.toMatch(/create (or replace )?function public\.create_pos_order_atomic_unvalidated_0024\(/);
    expect(lowered).not.toMatch(/create (or replace )?function public\.create_pos_order_atomic\(/);
  });
});
