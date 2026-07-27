import type {
  HongToLucMigrationWriteSet,
  RecoverySnapshotMetadata,
} from "@/lib/hong-luc-migration";
import {
  classifyHongToLucRpcProbe,
  type HongToLucRpcReadiness,
} from "@/lib/hong-luc-migration-rpc-readiness";
import { getSupabaseClient } from "@/lib/supabase";

export { classifyHongToLucRpcProbe };

export type ApplyHongToLucMigrationInput = {
  migrationKey: string;
  sourceHash: string;
  snapshot: RecoverySnapshotMetadata;
  writeSet: HongToLucMigrationWriteSet;
};

type ApplyHongToLucMigrationRpcResult = {
  migration_key: string;
  already_applied: boolean;
  changed_lines: number;
  replaced_ledger_rows: number;
  inserted_ledger_rows: number;
  inserted_events: number;
  deleted_recipes: number;
};

export type HongToLucMigrationRun = {
  migrationKey: string;
  sourceHash: string;
  snapshotId: string;
  manifestSha256: string;
  writeSet: HongToLucMigrationWriteSet;
};

export async function ensureHongToLucMigrationRpcReady(): Promise<
  HongToLucRpcReadiness
> {
  const { error } = await getSupabaseClient().rpc(
    "apply_hong_to_luc_migration",
    {
      p_migration_key: "__RPC_DEPLOYMENT_PROBE__",
      p_source_hash: "",
      p_snapshot_id: "",
      p_manifest_sha256: "",
      p_write_set: {},
    },
  );
  const result = classifyHongToLucRpcProbe(error);
  if (result.status === "READY") return result;
  if (result.status === "NOT_DEPLOYED") {
    throw new Error(
      "Deploy supabase/migrations/0009_hong_to_luc_migration.sql first. " +
      "See README or run via psql.",
    );
  }
  if (result.status === "UNSAFE") {
    throw new Error("RPC deployment probe payload was unexpectedly accepted.");
  }
  throw new Error(`RPC deployment probe failed: ${result.detail}`);
}

export async function getHongToLucMigrationRun(
  migrationKey: string,
): Promise<HongToLucMigrationRun | null> {
  const { data, error } = await getSupabaseClient()
    .from("data_migration_runs")
    .select(
      "migration_key,source_hash,snapshot_id,manifest_sha256,write_set",
    )
    .eq("migration_key", migrationKey)
    .maybeSingle();
  if (error) {
    throw new Error(`Read data_migration_runs: ${error.message}`);
  }
  if (!data) return null;
  return {
    migrationKey: String(data.migration_key),
    sourceHash: String(data.source_hash),
    snapshotId: String(data.snapshot_id),
    manifestSha256: String(data.manifest_sha256),
    writeSet: data.write_set as HongToLucMigrationWriteSet,
  };
}

export async function applyHongToLucMigration(
  input: ApplyHongToLucMigrationInput,
): Promise<{
  migrationKey: string;
  alreadyApplied: boolean;
  changedLines: number;
  replacedLedgerRows: number;
  insertedLedgerRows: number;
  insertedEvents: number;
  deletedRecipes: number;
}> {
  if (!input.snapshot.verified) {
    throw new Error("Recovery snapshot must be verified before apply.");
  }
  const { data, error } = await getSupabaseClient().rpc(
    "apply_hong_to_luc_migration",
    {
      p_migration_key: input.migrationKey,
      p_source_hash: input.sourceHash,
      p_snapshot_id: input.snapshot.id,
      p_manifest_sha256: input.snapshot.manifestSha256,
      p_write_set: input.writeSet,
    },
  );
  if (error) {
    throw new Error(`apply_hong_to_luc_migration: ${error.message}`);
  }
  const result = data as ApplyHongToLucMigrationRpcResult | null;
  if (!result || result.migration_key !== input.migrationKey) {
    throw new Error("apply_hong_to_luc_migration returned an invalid result.");
  }
  const output = {
    migrationKey: result.migration_key,
    alreadyApplied: Boolean(result.already_applied),
    changedLines: Number(result.changed_lines) || 0,
    replacedLedgerRows: Number(result.replaced_ledger_rows) || 0,
    insertedLedgerRows: Number(result.inserted_ledger_rows) || 0,
    insertedEvents: Number(result.inserted_events) || 0,
    deletedRecipes: Number(result.deleted_recipes) || 0,
  };
  const expectedCounts = result.already_applied
    ? {
      changedLines: 0,
      replacedLedgerRows: 0,
      insertedLedgerRows: 0,
      insertedEvents: 0,
      deletedRecipes: 0,
    }
    : {
      changedLines: input.writeSet.lineUpdates.length,
      replacedLedgerRows: input.writeSet.ledgerBefore.length,
      insertedLedgerRows: input.writeSet.ledgerAfter.length,
      insertedEvents: input.writeSet.events.length,
      deletedRecipes: 1,
    };
  if (
    output.changedLines !== expectedCounts.changedLines ||
    output.replacedLedgerRows !== expectedCounts.replacedLedgerRows ||
    output.insertedLedgerRows !== expectedCounts.insertedLedgerRows ||
    output.insertedEvents !== expectedCounts.insertedEvents ||
    output.deletedRecipes !== expectedCounts.deletedRecipes
  ) {
    throw new Error(
      "apply_hong_to_luc_migration persisted row count mismatch.",
    );
  }
  return output;
}
