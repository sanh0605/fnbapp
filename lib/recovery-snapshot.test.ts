import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildRecoveryRunId,
  createSnapshotBundleFiles,
  verifySnapshotBundleFiles,
} from "@/lib/recovery-snapshot";

describe("createSnapshotBundleFiles", () => {
  it("preserves raw inputs and creates deterministic canonical files", () => {
    const files = createSnapshotBundleFiles({
      runId: "recovery-20260701T120000000Z",
      capturedAt: "2026-07-01T12:00:00.000Z",
      sheets: {
        Brands: {
          values: [
            ["id", "name"],
            ["BR-002", "Second"],
            ["BR-001", "First"],
          ],
          formulaValues: [
            ["id", "name"],
            ["BR-002", "=A1"],
            ["BR-001", "First"],
          ],
        },
      },
      supabase: {
        brands: [
          { name: "Second", id: "BR-002" },
          { name: "First", id: "BR-001" },
        ],
      },
    });

    expect(JSON.parse(files["google-sheets/Brands.raw.json"])).toEqual({
      values: [
        ["id", "name"],
        ["BR-002", "Second"],
        ["BR-001", "First"],
      ],
      formulaValues: [
        ["id", "name"],
        ["BR-002", "=A1"],
        ["BR-001", "First"],
      ],
    });
    expect(
      JSON.parse(files["canonical/google-sheets/Brands.json"]),
    ).toEqual([
      { id: "BR-001", name: "First" },
      { id: "BR-002", name: "Second" },
    ]);
    expect(JSON.parse(files["canonical/supabase/brands.json"])).toEqual([
      { id: "BR-001", name: "First" },
      { id: "BR-002", name: "Second" },
    ]);
  });

  it("hashes every data file and records row and column summaries", () => {
    const files = createSnapshotBundleFiles({
      runId: "recovery-20260701T120000000Z",
      capturedAt: "2026-07-01T12:00:00.000Z",
      sheets: {
        Units: {
          values: [
            ["id", "name"],
            ["U-001", "gram"],
          ],
        },
      },
      supabase: {
        units: [{ id: "U-001", name: "gram", status: "ACTIVE" }],
      },
    });
    const manifest = JSON.parse(files["manifest.json"]);
    const rawPath = "google-sheets/Units.raw.json";
    const expectedHash = createHash("sha256")
      .update(files[rawPath])
      .digest("hex");

    expect(manifest.files[rawPath].sha256).toBe(expectedHash);
    expect(manifest.sources.googleSheets.Units).toEqual({
      rowCount: 1,
      columns: ["id", "name"],
      ids: ["U-001"],
    });
    expect(manifest.sources.supabase.units).toEqual({
      rowCount: 1,
      columns: ["id", "name", "status"],
      ids: ["U-001"],
    });
  });

  it("binds a migration source hash into the immutable manifest", () => {
    const sourceHash = "a".repeat(64);
    const files = createSnapshotBundleFiles({
      runId: "recovery-20260701T120000000Z",
      capturedAt: "2026-07-01T12:00:00.000Z",
      sourceHash,
      sheets: {},
      supabase: {},
    });

    expect(JSON.parse(files["manifest.json"]).sourceHash).toBe(sourceHash);
  });

  it("rejects unsafe run IDs", () => {
    expect(() =>
      createSnapshotBundleFiles({
        runId: "../overwrite",
        capturedAt: "2026-07-01T12:00:00.000Z",
        sheets: {},
        supabase: {},
      }),
    ).toThrow("Invalid recovery run ID");
  });
});

describe("buildRecoveryRunId", () => {
  it("builds a filesystem-safe UTC run ID", () => {
    expect(
      buildRecoveryRunId(new Date("2026-07-01T12:34:56.789Z")),
    ).toBe("recovery-20260701T123456789Z");
  });
});

describe("verifySnapshotBundleFiles", () => {
  it("accepts an unchanged bundle and rejects tampered content", () => {
    const files = createSnapshotBundleFiles({
      runId: "recovery-20260701T120000000Z",
      capturedAt: "2026-07-01T12:00:00.000Z",
      sheets: {
        Units: {
          values: [
            ["id", "name"],
            ["U-001", "gram"],
          ],
        },
      },
      supabase: {
        units: [{ id: "U-001", name: "gram" }],
      },
    });

    expect(verifySnapshotBundleFiles(files)).toEqual({
      valid: true,
      checkedFiles: 4,
      errors: [],
    });

    const tampered = {
      ...files,
      "supabase/units.raw.json": '{"rows":[]}\n',
    };
    expect(verifySnapshotBundleFiles(tampered)).toEqual({
      valid: false,
      checkedFiles: 4,
      errors: [
        "Hash mismatch: supabase/units.raw.json",
        "Byte count mismatch: supabase/units.raw.json",
      ],
    });
  });
});
