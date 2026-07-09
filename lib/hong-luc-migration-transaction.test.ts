import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}));

import {
  applyHongToLucMigration,
  classifyHongToLucRpcProbe,
  ensureHongToLucMigrationRpcReady,
  getHongToLucMigrationRun,
} from "@/lib/hong-luc-migration-transaction";

describe("applyHongToLucMigration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.select.mockReturnValue({ eq: mocks.eq });
    mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle });
  });

  it("classifies an undeployed migration RPC", () => {
    expect(classifyHongToLucRpcProbe({
      message:
        "Could not find the function public.apply_hong_to_luc_migration in the schema cache",
    })).toEqual({
      status: "NOT_DEPLOYED",
      detail: "RPC is absent from the schema cache",
    });
  });

  it("classifies the expected bad-payload guard as ready", () => {
    expect(classifyHongToLucRpcProbe({
      message: "Unsupported migration key",
    })).toEqual({
      status: "READY",
      detail: "Guard rejected probe payload",
    });
  });

  it("probes deployment with a guaranteed non-writing payload", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Unsupported migration key" },
    });

    await expect(ensureHongToLucMigrationRpcReady()).resolves.toEqual({
      status: "READY",
      detail: "Guard rejected probe payload",
    });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "apply_hong_to_luc_migration",
      {
        p_migration_key: "__RPC_DEPLOYMENT_PROBE__",
        p_source_hash: "",
        p_snapshot_id: "",
        p_manifest_sha256: "",
        p_write_set: {},
      },
    );
  });

  it("refuses apply with deployment instructions when RPC is absent", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        message:
          "Could not find the function public.apply_hong_to_luc_migration in the schema cache",
      },
    });

    await expect(ensureHongToLucMigrationRpcReady()).rejects.toThrow(
      "Deploy supabase/migrations/0009_hong_to_luc_migration.sql first. See README or run via psql.",
    );
  });

  it("runs the deployment probe before reading migration state", () => {
    const script = readFileSync(
      resolve(
        process.cwd(),
        "scripts/migrate-hong-tra-to-luc-tra.ts",
      ),
      "utf8",
    );
    const probePosition = script.indexOf(
      "await ensureHongToLucMigrationRpcReady()",
    );
    const stateReadPosition = script.indexOf(
      "await getHongToLucMigrationRun(MIGRATION_KEY)",
    );

    expect(probePosition).toBeGreaterThan(-1);
    expect(probePosition).toBeLessThan(stateReadPosition);
    expect(script).toContain("process.exitCode = 1");
  });

  it("documents semantic ledger idempotency comparison in migration 0010", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "supabase/migrations/0010_hong_to_luc_idempotency_fix.sql",
      ),
      "utf8",
    );
    const existingRunBranch = migration.slice(
      migration.indexOf("if v_existing.migration_key is not null then"),
      migration.indexOf("return jsonb_build_object("),
    );
    const ledgerCheck = existingRunBranch.slice(
      existingRunBranch.indexOf("with expected_rows as"),
      existingRunBranch.indexOf(
        "raise exception 'Partial migration state: target ledger fingerprint mismatch'",
      ),
    );

    expect(ledgerCheck).toContain("expected->>'transaction_type' as transaction_type");
    expect(ledgerCheck).toContain("expected->>'reference_id' as reference_id");
    expect(ledgerCheck).toContain("expected->>'item_reference' as item_reference");
    expect(ledgerCheck).toContain("(expected->>'quantity_change')::numeric as quantity_change");
    expect(ledgerCheck).toContain("coalesce(expected->>'source', '') as source");
    expect(ledgerCheck).toContain("ledger.transaction_type");
    expect(ledgerCheck).toContain("ledger.reference_id");
    expect(ledgerCheck).toContain("ledger.item_reference");
    expect(ledgerCheck).toContain("ledger.quantity_change");
    expect(ledgerCheck).toContain("coalesce(ledger.source, '') as source");
    expect(ledgerCheck).toContain("except all");
    expect(ledgerCheck).not.toContain("ledger.id = expected->>'id'");
    expect(ledgerCheck).not.toContain("ledger.created_at");
  });

  it("loads the immutable write set for an idempotent rerun", async () => {
    const writeSet = {
      orders: [],
      lineUpdates: [],
      ledgerBefore: [],
      ledgerAfter: [],
      eventsBefore: [],
      events: [],
      corruptRecipe: {},
    };
    mocks.maybeSingle.mockResolvedValue({
      data: {
        migration_key: "HONG_TO_LUC_2026-06-29_V1",
        source_hash: "a".repeat(64),
        snapshot_id: "recovery-20260704T170000000Z",
        manifest_sha256: "b".repeat(64),
        write_set: writeSet,
      },
      error: null,
    });

    await expect(getHongToLucMigrationRun(
      "HONG_TO_LUC_2026-06-29_V1",
    )).resolves.toEqual({
      migrationKey: "HONG_TO_LUC_2026-06-29_V1",
      sourceHash: "a".repeat(64),
      snapshotId: "recovery-20260704T170000000Z",
      manifestSha256: "b".repeat(64),
      writeSet,
    });
    expect(mocks.from).toHaveBeenCalledWith("data_migration_runs");
  });

  it("sends the complete migration write set in one RPC", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        migration_key: "HONG_TO_LUC_2026-06-29_V1",
        already_applied: false,
        changed_lines: 1,
        replaced_ledger_rows: 1,
        inserted_ledger_rows: 1,
        inserted_events: 1,
        deleted_recipes: 1,
      },
      error: null,
    });
    const input = {
      migrationKey: "HONG_TO_LUC_2026-06-29_V1",
      sourceHash: "a".repeat(64),
      snapshot: {
        id: "recovery-20260704T170000000Z",
        manifestSha256: "b".repeat(64),
        verified: true,
      },
      writeSet: {
        orders: [{ id: "order-1", order_no: "ORDER-1" }],
        lineUpdates: [{ lineId: "line-1", before: {}, after: {} }],
        ledgerBefore: [{ id: "old-ledger-1" }],
        ledgerAfter: [{ id: "new-ledger-1" }],
        eventsBefore: [],
        events: [{ id: "event-1" }],
        corruptRecipe: { id: "REC-068" },
      },
    };

    const result = await applyHongToLucMigration(input);

    expect(mocks.rpc).toHaveBeenCalledWith(
      "apply_hong_to_luc_migration",
      {
        p_migration_key: input.migrationKey,
        p_source_hash: input.sourceHash,
        p_snapshot_id: input.snapshot.id,
        p_manifest_sha256: input.snapshot.manifestSha256,
        p_write_set: input.writeSet,
      },
    );
    expect(result).toEqual({
      migrationKey: input.migrationKey,
      alreadyApplied: false,
      changedLines: 1,
      replacedLedgerRows: 1,
      insertedLedgerRows: 1,
      insertedEvents: 1,
      deletedRecipes: 1,
    });
  });

  it("fails closed on an RPC refusal", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "Source fingerprint mismatch" },
    });

    await expect(applyHongToLucMigration({
      migrationKey: "HONG_TO_LUC_2026-06-29_V1",
      sourceHash: "a".repeat(64),
      snapshot: {
        id: "recovery-20260704T170000000Z",
        manifestSha256: "b".repeat(64),
        verified: true,
      },
      writeSet: {
        orders: [],
        lineUpdates: [],
        ledgerBefore: [],
        ledgerAfter: [],
        eventsBefore: [],
        events: [],
        corruptRecipe: {},
      },
    })).rejects.toThrow("Source fingerprint mismatch");
  });

  it("fails closed when the RPC reports incomplete write counts", async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        migration_key: "HONG_TO_LUC_2026-06-29_V1",
        already_applied: false,
        changed_lines: 3,
        replaced_ledger_rows: 29,
        inserted_ledger_rows: 1,
        inserted_events: 4,
        deleted_recipes: 1,
      },
      error: null,
    });

    await expect(applyHongToLucMigration({
      migrationKey: "HONG_TO_LUC_2026-06-29_V1",
      sourceHash: "a".repeat(64),
      snapshot: {
        id: "recovery-20260704T170000000Z",
        manifestSha256: "b".repeat(64),
        verified: true,
      },
      writeSet: {
        orders: Array.from({ length: 4 }, (_, index) => ({ id: `order-${index}` })),
        lineUpdates: Array.from({ length: 4 }, (_, index) => ({
          lineId: `line-${index}`,
          before: {},
          after: {},
        })),
        ledgerBefore: Array.from({ length: 29 }, (_, index) => ({ id: `old-${index}` })),
        ledgerAfter: [{ id: "new-1" }],
        eventsBefore: [],
        events: Array.from({ length: 4 }, (_, index) => ({ id: `event-${index}` })),
        corruptRecipe: { id: "REC-068" },
      },
    })).rejects.toThrow("persisted row count mismatch");
  });
});
