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
      shifts: [{ id: "OK-1" }],
    });

    const results = await restoreBundleToTarget(bundle, client, ["data_recovery_changes", "shifts"]);

    expect(results).toEqual([
      { table: "data_recovery_changes", inserted: 0, skipped: [{ row: { id: "BAD" }, error: "bad row" }], substituted: 0 },
      { table: "shifts", inserted: 1, skipped: [], substituted: 0 },
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
      cash_entries: [{ id: "CE-1", note: null }],
    });

    const results = await restoreBundleToTarget(bundle, client, ["cash_entries"], 500);

    expect(insertCalls[0]).toEqual([{ id: "CE-1", note: null }]);
    expect(results).toEqual([{ table: "cash_entries", inserted: 1, skipped: [], substituted: 0 }]);
  });

  // BR-CASH-001 answer 3a: migration 0107 backfilled every existing purchase
  // order as cash. A bundle taken before it has no such columns, and a
  // COMPLETED row without payment_method would be refused by the new check.
  it("fills CASH and no account on a purchase order row from a bundle taken before 0107", async () => {
    const insertCalls: unknown[][] = [];
    const client = fakeClient((_table, rows) => {
      insertCalls.push(rows);
      return { error: null };
    });
    const bundle = fakeBundle({
      purchase_orders: [{ id: "PO-181", status: "COMPLETED", supplier_invoice_code: null }],
    });

    const results = await restoreBundleToTarget(bundle, client, ["purchase_orders"], 500);

    expect(insertCalls[0]).toEqual([
      { id: "PO-181", status: "COMPLETED", supplier_invoice_code: null, payment_method: "CASH", bank_account_id: null },
    ]);
    expect(results).toEqual([{ table: "purchase_orders", inserted: 1, skipped: [], substituted: 0 }]);
  });

  it("leaves a purchase order row that already has the payment columns exactly as saved", async () => {
    const insertCalls: unknown[][] = [];
    const client = fakeClient((_table, rows) => {
      insertCalls.push(rows);
      return { error: null };
    });
    const rows = [
      { id: "PO-1", status: "COMPLETED", payment_method: "BANK_TRANSFER", bank_account_id: "BA-001" },
      { id: "PO-2", status: "DRAFT", payment_method: null, bank_account_id: null }, // undecided draft stays null
    ];

    await restoreBundleToTarget(fakeBundle({ purchase_orders: rows }), client, ["purchase_orders"], 500);

    expect(insertCalls[0]).toEqual(rows);
  });

  describe("modifiers from a bundle taken before migration 0120", () => {
    const groups = [{ id: "MG-001", name: "Thêm Topping" }];
    const notNull = (_t: string, rows: unknown[]) =>
      (rows as Array<{ group_id?: string }>).every(r => r.group_id)
        ? { error: null }
        : { error: { message: "null value in column group_id" } };

    it("takes group_id from the group with the saved name when 0119 had not run, and drops group_name", async () => {
      const insertCalls: unknown[][] = [];
      const client = fakeClient((t, rows) => (insertCalls.push(rows), notNull(t, rows)));
      const bundle = fakeBundle({ modifier_groups: groups, modifiers: [{ id: "MOD-002", group_name: "Thêm Topping", price: 4000 }] });

      await restoreBundleToTarget(bundle, client, ["modifiers"], 500);

      expect(insertCalls[0]).toEqual([{ id: "MOD-002", group_id: "MG-001", price: 4000 }]);
    });

    it("keeps the saved group_id and drops group_name when the row has both", async () => {
      const insertCalls: unknown[][] = [];
      const client = fakeClient((_t, rows) => (insertCalls.push(rows), { error: null }));
      const bundle = fakeBundle({ modifier_groups: groups, modifiers: [{ id: "MOD-002", group_id: "MG-009", group_name: "Thêm Topping" }] });

      await restoreBundleToTarget(bundle, client, ["modifiers"], 500);

      expect(insertCalls[0]).toEqual([{ id: "MOD-002", group_id: "MG-009" }]);
    });

    it("reports a row whose name matches no group as skipped instead of dropping it", async () => {
      const client = fakeClient(notNull);
      const bundle = fakeBundle({ modifier_groups: groups, modifiers: [{ id: "MOD-009", group_name: "Mức đá" }] });

      const [result] = await restoreBundleToTarget(bundle, client, ["modifiers"], 500);

      expect(result.inserted).toBe(0);
      expect(result.skipped).toEqual([{ row: { id: "MOD-009" }, error: "null value in column group_id" }]);
    });
  });
});
describe("rows from a bundle taken before migration 0121", () => {
  const insertsOf = (calls: Array<{ table: string; rows: unknown[] }>, table: string) =>
    calls.filter(c => c.table === table).flatMap(c => c.rows);

  it("drops the retired columns and turns empty link text into null", async () => {
    const calls: Array<{ table: string; rows: unknown[] }> = [];
    const client = fakeClient((table, rows) => (calls.push({ table, rows }), { error: null }));
    const bundle = fakeBundle({
      orders_v2: [{ id: "o1", version: 1, currency: "VND", payment_ref: "", parent_order_id: "", superseded_by: "", voided_by_id: "", applied_promotion_id: "PRM-003" }],
      order_lines_v2: [{ id: "l1", qty: 1, cost_at_sale: 0, recipe_snapshot_json: {}, manual_discount_reason: "" }],
      order_events: [{ id: "e1", previous_order_id: "" }],
      products: [{ id: "P1", description: null, brand_id: null, sort_order: 0 }],
      product_variants: [{ id: "V1", sort_order: 0 }],
      modifiers: [{ id: "M1", group_id: "MG-1", sort_order: 0 }],
    });

    await restoreBundleToTarget(bundle, client, ["orders_v2", "order_lines_v2", "order_events", "products", "product_variants", "modifiers"], 500);

    expect(insertsOf(calls, "orders_v2")).toEqual([{ id: "o1", version: 1, parent_order_id: null, superseded_by: null, voided_by_id: null, applied_promotion_id: "PRM-003" }]);
    expect(insertsOf(calls, "order_lines_v2")).toEqual([{ id: "l1", qty: 1 }]);
    expect(insertsOf(calls, "order_events")).toEqual([{ id: "e1", previous_order_id: null }]);
    expect(insertsOf(calls, "products")).toEqual([{ id: "P1" }]);
    expect(insertsOf(calls, "product_variants")).toEqual([{ id: "V1" }]);
    expect(insertsOf(calls, "modifiers")).toEqual([{ id: "M1", group_id: "MG-1" }]);
  });

  it("inserts orders oldest version first and links superseded_by afterwards, since the two rows point at each other", async () => {
    const order: string[] = [];
    const client = {
      from: () => ({
        insert: (rows: Array<{ id: string; superseded_by: unknown }>) => {
          rows.forEach(r => order.push(`insert ${r.id} superseded_by=${r.superseded_by}`));
          return Promise.resolve({ error: null });
        },
        update: (values: { superseded_by: string }) => ({
          eq: (_col: string, id: string) => (order.push(`update ${id} -> ${values.superseded_by}`), Promise.resolve({ error: null })),
        }),
      }),
    } as any;
    const bundle = fakeBundle({
      orders_v2: [
        { id: "new", version: 2, parent_order_id: "old", superseded_by: "" },
        { id: "old", version: 1, parent_order_id: "", superseded_by: "new" },
      ],
    });

    await restoreBundleToTarget(bundle, client, ["orders_v2"], 500);

    expect(order).toEqual(["insert old superseded_by=null", "insert new superseded_by=null", "update old -> new"]);
  });

  it("inserts a SUPERSEDED order as COMPLETED and restores status with superseded_by in one update", async () => {
    const inserted: unknown[] = [];
    const updates: unknown[] = [];
    const client = {
      from: () => ({
        insert: (rows: unknown[]) => (inserted.push(...rows), Promise.resolve({ error: null })),
        update: (values: unknown) => ({ eq: (_col: string, id: string) => (updates.push({ id, ...(values as object) }), Promise.resolve({ error: null })) }),
      }),
    } as any;
    const bundle = fakeBundle({ orders_v2: [{ id: "old", version: 1, status: "SUPERSEDED", superseded_by: "new" }] });

    await restoreBundleToTarget(bundle, client, ["orders_v2"], 500);

    expect(inserted).toEqual([{ id: "old", version: 1, status: "COMPLETED", superseded_by: null }]);
    expect(updates).toEqual([{ id: "old", status: "SUPERSEDED", superseded_by: "new" }]);
  });
});

describe("rows from a bundle taken before migration 0133", () => {
  it("drops the seven columns that migration removed", async () => {
    const calls: Array<{ table: string; rows: unknown[] }> = [];
    const client = fakeClient((table, rows) => (calls.push({ table, rows }), { error: null }));
    const bundle = fakeBundle({
      purchased_items: [{ id: "I1", default_unit_id: "" }],
      suppliers: [{ id: "S1", parent_id: "" }],
      units: [{ id: "U1", abbreviation: "" }],
      product_price_history: [{ id: "H1", reason: "" }],
      asset_depreciation_bands: [{ id: "B1", status: "ACTIVE" }],
      purchase_order_lines: [{ id: "L1", base_unit: "U1" }],
      products: [{ id: "P1", image_url: "" }],
    });

    await restoreBundleToTarget(bundle, client, ["purchased_items", "suppliers", "units", "product_price_history", "asset_depreciation_bands", "purchase_order_lines", "products"], 500);

    expect(calls.map(c => c.rows)).toEqual([[{ id: "I1" }], [{ id: "S1" }], [{ id: "U1" }], [{ id: "H1" }], [{ id: "B1" }], [{ id: "L1" }], [{ id: "P1" }]]);
  });
});

describe("rows from a bundle taken before migration 0135", () => {
  it("drops completed_at and pos_snapshot_json from orders_v2", async () => {
    const calls: Array<{ table: string; rows: unknown[] }> = [];
    const client = fakeClient((table, rows) => (calls.push({ table, rows }), { error: null }));
    const bundle = fakeBundle({
      orders_v2: [{ id: "O1", completed_at: "2026-06-01T00:00:00Z", pos_snapshot_json: {} }],
    });

    await restoreBundleToTarget(bundle, client, ["orders_v2"], 500);

    expect(calls.map(c => c.rows)).toEqual([[{ id: "O1" }]]);
  });
});
