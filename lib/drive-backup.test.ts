import { describe, expect, it } from "vitest";
import {
  BACKUP_TABLES,
  buildBackupBundle,
  buildBackupFileName,
  validateBackupBundle,
} from "../supabase/functions/backup-to-drive/core";

describe("Google Drive backup core", () => {
  it("pins the complete 27-table snapshot policy", () => {
    expect(BACKUP_TABLES).toHaveLength(27);
    expect(new Set(BACKUP_TABLES).size).toBe(27);
    expect(BACKUP_TABLES).toContain("orders_v2");
    expect(BACKUP_TABLES).toContain("stock_ledger");
    expect(BACKUP_TABLES).toContain("users");
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
      schemaVersion: 1,
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

  it("rejects a snapshot missing any of the 27 required table keys", () => {
    const rows = new Map(BACKUP_TABLES.map(table => [table, []]));
    const complete = buildBackupBundle("2026-07-16T00:00:00.000Z", rows);
    expect(validateBackupBundle(complete)).toEqual({ tableCount: 27, totalRowCount: 0 });

    delete complete.tables.users;
    expect(() => validateBackupBundle(complete)).toThrow(/missing.*users/i);
  });
});
