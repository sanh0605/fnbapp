import { describe, expect, it } from "vitest";
import {
  BACKUP_TABLES,
  BACKUP_TABLE_ORDER_COLUMNS,
  buildBackupBundle,
  buildBackupFileName,
  validateBackupBundle,
} from "../supabase/functions/backup-to-drive/core";

describe("Google Drive backup core", () => {
  it("pins the complete 41-table snapshot policy", () => {
    expect(BACKUP_TABLES).toHaveLength(41);
    expect(new Set(BACKUP_TABLES).size).toBe(41);
    expect(BACKUP_TABLES).toContain("orders_v2");
    expect(BACKUP_TABLES).toContain("stock_ledger");
    expect(BACKUP_TABLES).toContain("users");
    expect(BACKUP_TABLES).toContain("sync_state");
    expect(BACKUP_TABLES).toContain("data_migration_runs");
    expect(BACKUP_TABLES).toContain("data_recovery_changes");
    expect(BACKUP_TABLES).toContain("audit_baseline_locks");
    expect(BACKUP_TABLES).toContain("backdated_ledger_events");
    expect(BACKUP_TABLE_ORDER_COLUMNS.sync_state).toBe("sync_key");
    expect(BACKUP_TABLE_ORDER_COLUMNS.data_migration_runs).toBe("migration_key");
    expect(BACKUP_TABLE_ORDER_COLUMNS.data_recovery_changes)
      .toBe("run_id.asc,table_name.asc,row_id.asc,column_name");
    expect(BACKUP_TABLE_ORDER_COLUMNS.audit_baseline_locks).toBe("order_line_id");
  });

  it("covers every persisted table except deliberately derived ones", () => {
    for (const table of [
      "order_payments",
      "shifts",
      "shift_stock_checks",
      "stocktake_sessions",
      "stocktake_lines",
      "stock_issues",
      "backdated_recipe_events",
      "purchase_order_edits",
      "pos_sync_failures",
    ]) {
      expect(BACKUP_TABLES).toContain(table);
    }
  });

  it("excludes inventory_balances, which is derived and rebuilt from stock_ledger", () => {
    expect(BACKUP_TABLES).not.toContain("inventory_balances");
  });

  it("builds the schema-versioned recovery bundle with counts", () => {
    const bundle = buildBackupBundle(
      "2026-07-16T19:30:00.000Z",
      new Map([
        ["orders_v2", [{ id: "ORDER-1" }]],
        ["order_lines_v2", [{ id: "LINE-1" }, { id: "LINE-2" }]],
      ]),
      ["orders_v2", "order_lines_v2"],
    );

    expect(bundle).toEqual({
      capturedAt: "2026-07-16T19:30:00.000Z",
      schemaVersion: 2,
      tables: {
        orders_v2: { rows: [{ id: "ORDER-1" }], count: 1 },
        order_lines_v2: { rows: [{ id: "LINE-1" }, { id: "LINE-2" }], count: 2 },
      },
    });
  });

  it("uses the Saigon calendar date for the daily backup filename", () => {
    expect(buildBackupFileName("2026-07-16T19:30:00.000Z"))
      .toBe("fnbapp-backup-2026-07-17.json");
  });

  it("rejects a snapshot missing any of the 41 required table keys", () => {
    const rows = new Map(BACKUP_TABLES.map(table => [table, []]));
    const complete = buildBackupBundle("2026-07-16T00:00:00.000Z", rows);
    expect(validateBackupBundle(complete)).toEqual({ tableCount: 41, totalRowCount: 0 });

    delete complete.tables.users;
    expect(() => validateBackupBundle(complete)).toThrow(/missing.*users/i);
  });
});
