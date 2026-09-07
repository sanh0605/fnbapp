import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0014_backdated_ledger_detection.sql"),
  "utf8",
).toLowerCase();

describe("backdated ledger detection migration", () => {
  it("does not flag stock ledger rows created at the current insert time", () => {
    expect(migration).toContain("if new.created_at < now() - interval '5 minutes' then");
    expect(migration).toContain("insert into public.backdated_ledger_events");
  });

  it("flags rows older than the five-minute threshold with the expected event fields", () => {
    expect(migration).toContain("stock_ledger_id");
    expect(migration).toContain("effective_timestamp");
    expect(migration).toContain("visibility_timestamp");
    expect(migration).toContain("quantity_change");
    expect(migration).toContain("unit_cost");
  });

  it("bypasses detection while MAC drift recovery is active", () => {
    expect(migration).toContain("current_setting('app.mac_drift_recovery', true) = 'on'");
    expect(migration).toContain("return new;");
  });

  it("does not flag sales consume rows", () => {
    expect(migration).toContain("new.transaction_type not in ('po_receipt', 'stock_adjust', 'production_yield', 'initial_balance')");
    expect(migration).not.toContain("'sales_consume', 'po_receipt'");
  });

  it("includes initial balance in the future detection trigger without changing stock ledger constraints", () => {
    expect(migration).toContain("'initial_balance'");
    expect(migration).not.toContain("alter table public.stock_ledger");
    expect(migration).not.toContain("transaction_type_check");
  });
});
