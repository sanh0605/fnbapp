import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// docs/superpowers/plans/2026-09-02-phase-d-drop-the-ledger-tables.md
// section 2.2: exactly four statements, in order (trigger, trigger
// function, inventory_balances, stock_ledger), no CASCADE, no IF EXISTS
// -- both deliberately, per the plan's own reasoning: a refused drop is
// information (something depends on these tables that live measurement
// missed), not an obstacle to route around by adding CASCADE or IF
// EXISTS to silence it.
const MIGRATION_FILE = "0096_phase_d_drop_ledger_tables.sql";

function readMigration(): string {
  return readFileSync(
    resolve(process.cwd(), "supabase/migrations", MIGRATION_FILE),
    "utf8",
  );
}

// Strip `--` line comments before searching -- the header comment
// legitimately discusses CASCADE/IF EXISTS while explaining why they are
// deliberately absent, and legitimately names both tables at length.
function readMigrationCodeOnly(): string {
  return readMigration()
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("Phase D (0096): drop stock_ledger and inventory_balances", () => {
  it("drops the trigger, the trigger function, and both tables -- exactly these four statements", () => {
    const code = readMigrationCodeOnly();
    expect(code).toContain("drop trigger trg_stock_ledger_inventory_balances on public.stock_ledger;");
    expect(code).toContain("drop function public.stock_ledger_apply_inventory_balance_delta();");
    expect(code).toContain("drop table public.inventory_balances;");
    expect(code).toContain("drop table public.stock_ledger;");
  });

  // Order matters: the trigger before the table it fires on; the balance
  // table (written only by that trigger) before the ledger table (what
  // the trigger is defined on); the trigger function among the first
  // three, after the trigger that references it.
  it("drops them in the required order", () => {
    const code = readMigrationCodeOnly();
    const triggerIdx = code.indexOf("drop trigger trg_stock_ledger_inventory_balances");
    const functionIdx = code.indexOf("drop function public.stock_ledger_apply_inventory_balance_delta");
    const balancesIdx = code.indexOf("drop table public.inventory_balances");
    const ledgerIdx = code.indexOf("drop table public.stock_ledger;");

    expect(triggerIdx).toBeGreaterThan(-1);
    expect(functionIdx).toBeGreaterThan(-1);
    expect(balancesIdx).toBeGreaterThan(-1);
    expect(ledgerIdx).toBeGreaterThan(-1);

    expect(triggerIdx).toBeLessThan(functionIdx);
    expect(functionIdx).toBeLessThan(balancesIdx);
    expect(balancesIdx).toBeLessThan(ledgerIdx);
  });

  // Deliberately no CASCADE, no IF EXISTS -- checked against the actual
  // statements, not the explanatory prose that names both terms while
  // explaining their absence.
  it("uses no CASCADE and no IF EXISTS in its actual statements", () => {
    const code = readMigrationCodeOnly().toLowerCase();
    expect(code).not.toContain("cascade");
    expect(code).not.toContain("if exists");
  });

  it("touches no table other than stock_ledger and inventory_balances", () => {
    const code = readMigrationCodeOnly().toLowerCase();
    const statementLines = code
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("drop "));
    expect(statementLines).toHaveLength(4);
    for (const line of statementLines) {
      expect(
        line.includes("stock_ledger") || line.includes("inventory_balances"),
      ).toBe(true);
    }
  });
});
