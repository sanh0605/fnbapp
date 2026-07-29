import { describe, expect, it, vi } from "vitest";
import { assertSafeRestoreTarget, restoreBundleToTarget, JSONB_NULL_LITERAL_SENTINEL } from "./backup-restore";
import type { BackupBundle } from "@/supabase/functions/backup-to-drive/core";

function fakeBundle(tables: Record<string, Array<Record<string, unknown>>>): BackupBundle {
  const bundleTables: BackupBundle["tables"] = {};
  for (const [table, rows] of Object.entries(tables)) {
    bundleTables[table] = { rows, count: rows.length };
  }
  return { capturedAt: "2026-07-29T00:00:00.000Z", schemaVersion: 2, tables: bundleTables };
}

function fakeClient(insertImpl: (table: string, rows: unknown[]) => { error: { message: string } | null }) {
  return {
    from: (table: string) => ({
      insert: (rows: unknown[]) => Promise.resolve(insertImpl(table, rows)),
    }),
  } as any;
}

describe("assertSafeRestoreTarget", () => {
  it("refuses to run when the target URL equals the production URL", () => {
    expect(() =>
      assertSafeRestoreTarget({
        productionUrl: "https://abc.supabase.co",
        targetUrl: "https://abc.supabase.co",
      }),
    ).toThrow(/production/i);
  });

  it("refuses to run when no explicit target is configured", () => {
    expect(() =>
      assertSafeRestoreTarget({ productionUrl: "https://abc.supabase.co", targetUrl: "" }),
    ).toThrow(/RESTORE_TARGET_SUPABASE_URL/);
  });

  it("allows a distinct, explicitly configured target", () => {
    expect(() =>
      assertSafeRestoreTarget({
        productionUrl: "https://abc.supabase.co",
        targetUrl: "https://scratch.supabase.co",
      }),
    ).not.toThrow();
  });
});

describe("restoreBundleToTarget", () => {
  it("inserts each table's rows and reports the count restored, in the given table order", async () => {
    const calls: Array<{ table: string; rows: unknown[] }> = [];
    const client = fakeClient((table, rows) => {
      calls.push({ table, rows });
      return { error: null };
    });
    const bundle = fakeBundle({
      brands: [{ id: "BR-1" }],
      products: [{ id: "P-1" }, { id: "P-2" }],
    });

    const results = await restoreBundleToTarget(bundle, client, ["brands", "products"]);

    expect(results).toEqual([
      { table: "brands", inserted: 1, skipped: [], substituted: 0 },
      { table: "products", inserted: 2, skipped: [], substituted: 0 },
    ]);
    expect(calls.map(c => c.table)).toEqual(["brands", "products"]);
  });

  it("skips a table with zero rows without calling insert", async () => {
    const insert = vi.fn(() => ({ error: null }));
    const client = fakeClient(insert);
    const bundle = fakeBundle({ stocktake_sessions: [] });

    const results = await restoreBundleToTarget(bundle, client, ["stocktake_sessions"]);

    expect(results).toEqual([{ table: "stocktake_sessions", inserted: 0, skipped: [], substituted: 0 }]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("batches large tables instead of inserting all rows in one call", async () => {
    const batches: number[] = [];
    const client = fakeClient((_table, rows) => {
      batches.push(rows.length);
      return { error: null };
    });
    const rows = Array.from({ length: 1200 }, (_, i) => ({ id: `ROW-${i}` }));
    const bundle = fakeBundle({ stock_ledger: rows });

    const results = await restoreBundleToTarget(bundle, client, ["stock_ledger"], 500);

    expect(batches).toEqual([500, 500, 200]);
    expect(results).toEqual([{ table: "stock_ledger", inserted: 1200, skipped: [], substituted: 0 }]);
  });

  it("isolates a single bad row by retrying the failed batch one row at a time, instead of losing every good row in it", async () => {
    // Mirrors the real finding: a NOT NULL jsonb column whose true value is
    // the JSON null literal (e.g. data_recovery_changes.old_value for a
    // FULLHISTORY_REBUILD "inserted" row) fails PostgREST's insert endpoint,
    // which always coerces a JSON null in the request body to SQL NULL. That
    // must not cost the other 499 rows in the same batch.
    const client = fakeClient((_table, rows) => {
      const hasBadRow = (rows as Array<{ id: string }>).some(r => r.id === "BAD");
      if (rows.length > 1 && hasBadRow) return { error: { message: "batch contains a bad row" } };
      if (rows.length === 1 && (rows[0] as { id: string }).id === "BAD") {
        return { error: { message: 'null value in column "old_value" violates not-null constraint' } };
      }
      return { error: null };
    });
    const bundle = fakeBundle({
      data_recovery_changes: [{ id: "GOOD-1" }, { id: "BAD" }, { id: "GOOD-2" }],
    });

    const results = await restoreBundleToTarget(bundle, client, ["data_recovery_changes"], 500);

    expect(results).toEqual([{
      table: "data_recovery_changes",
      inserted: 2,
      skipped: [{ row: { id: "BAD" }, error: 'null value in column "old_value" violates not-null constraint' }],
      substituted: 0,
    }]);
  });

  it("continues restoring later tables after a table has skipped rows", async () => {
    const client = fakeClient((table, rows) => {
      if (table === "data_recovery_changes") return { error: { message: "bad row" } };
      return { error: null };
    });
    const bundle = fakeBundle({
      data_recovery_changes: [{ id: "BAD" }],
      audit_baseline_locks: [{ id: "OK-1" }],
    });

    const results = await restoreBundleToTarget(bundle, client, ["data_recovery_changes", "audit_baseline_locks"]);

    expect(results).toEqual([
      { table: "data_recovery_changes", inserted: 0, skipped: [{ row: { id: "BAD" }, error: "bad row" }], substituted: 0 },
      { table: "audit_baseline_locks", inserted: 1, skipped: [], substituted: 0 },
    ]);
  });

  it("pre-substitutes a documented sentinel for data_recovery_changes.old_value/new_value nulls, so the batch succeeds on the first attempt", async () => {
    // Live finding: 29,349 of 31,132 production rows (94%) have a null
    // old_value or new_value -- a NOT NULL jsonb column whose true value is
    // the JSON null literal (e.g. a FULLHISTORY_REBUILD "inserted" row, where
    // there genuinely was no prior value). PostgREST's insert endpoint always
    // coerces a JSON null in the request body to SQL NULL, so at that rate
    // the generic retry-one-row-at-a-time fallback would need tens of
    // thousands of sequential network round trips. Pre-substituting a
    // documented sentinel for this one known table+columns lets the batch
    // insert succeed the first time, every time.
    const insertCalls: unknown[][] = [];
    const client = fakeClient((_table, rows) => {
      insertCalls.push(rows);
      return { error: null };
    });
    const bundle = fakeBundle({
      data_recovery_changes: [
        { id: "1", old_value: null, new_value: { a: 1 } },
        { id: "2", old_value: 5, new_value: null },
        { id: "3", old_value: 5, new_value: 6 },
      ],
    });

    const results = await restoreBundleToTarget(bundle, client, ["data_recovery_changes"], 500);

    expect(insertCalls).toHaveLength(1); // one batch call, no retry needed
    expect(insertCalls[0]).toEqual([
      { id: "1", old_value: JSONB_NULL_LITERAL_SENTINEL, new_value: { a: 1 } },
      { id: "2", old_value: 5, new_value: JSONB_NULL_LITERAL_SENTINEL },
      { id: "3", old_value: 5, new_value: 6 },
    ]);
    expect(results).toEqual([
      { table: "data_recovery_changes", inserted: 3, skipped: [], substituted: 2 },
    ]);
  });

  it("does not substitute null values in tables/columns outside the documented list", async () => {
    const insertCalls: unknown[][] = [];
    const client = fakeClient((_table, rows) => {
      insertCalls.push(rows);
      return { error: null };
    });
    const bundle = fakeBundle({
      purchase_orders: [{ id: "PO-1", supplier_invoice_code: null }],
    });

    const results = await restoreBundleToTarget(bundle, client, ["purchase_orders"], 500);

    expect(insertCalls[0]).toEqual([{ id: "PO-1", supplier_invoice_code: null }]);
    expect(results).toEqual([{ table: "purchase_orders", inserted: 1, skipped: [], substituted: 0 }]);
  });
});
