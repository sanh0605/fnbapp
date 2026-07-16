import { describe, expect, it, vi } from "vitest";
import { BACKUP_TABLES, buildBackupBundle } from "../supabase/functions/backup-to-drive/core";
import { handleSnapshotRequest } from "../supabase/functions/backup-to-drive/handler";

const token = "a".repeat(48);
const bundle = buildBackupBundle(
  "2026-07-16T00:00:00.000Z",
  new Map(BACKUP_TABLES.map(table => [table, []])),
);

describe("backup snapshot HTTP handler", () => {
  it("rejects missing or incorrect pull tokens without reading the database", async () => {
    const buildSnapshot = vi.fn(async () => bundle);
    for (const received of [undefined, "wrong-token"]) {
      const headers = received ? { "X-Backup-Token": received } : undefined;
      const response = await handleSnapshotRequest(
        new Request("https://example.test/backup", { method: "POST", headers }),
        { pullToken: token },
        buildSnapshot,
      );
      expect(response.status).toBe(401);
    }
    expect(buildSnapshot).not.toHaveBeenCalled();
  });

  it("returns the complete no-store bundle only for the exact token", async () => {
    const response = await handleSnapshotRequest(
      new Request("https://example.test/backup", {
        method: "POST",
        headers: { "X-Backup-Token": token },
      }),
      { pullToken: token },
      async () => bundle,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Backup-Table-Count")).toBe("27");
    expect(await response.json()).toEqual(bundle);
  });
});
