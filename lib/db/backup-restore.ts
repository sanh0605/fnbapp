import type { SupabaseClient } from "@supabase/supabase-js";
import { BACKUP_TABLES, type BackupBundle, type JsonRow } from "@/supabase/functions/backup-to-drive/core";

/**
 * Structural guard for the restore drill: a restore that could ever touch
 * production is not a drill. This must be the first thing the restore script
 * calls, before opening any client -- there is no code path past this
 * function that is allowed to write anywhere but an explicitly declared,
 * distinct scratch target.
 */
export function assertSafeRestoreTarget(input: {
  productionUrl: string;
  targetUrl: string;
}): void {
  const normalize = (url: string) => url.trim().replace(/\/+$/, "").toLowerCase();
  const target = normalize(input.targetUrl);
  if (!target) {
    throw new Error(
      "RESTORE_TARGET_SUPABASE_URL is not set. Refusing to restore without an explicit, distinct target.",
    );
  }
  const production = normalize(input.productionUrl);
  if (target === production) {
    throw new Error(
      "Restore target resolves to the production database. Refusing to restore into production.",
    );
  }
}

export type RestoreTableResult = {
  table: string;
  inserted: number;
  skipped: Array<{ row: JsonRow; error: string }>;
  substituted: number;
};

/**
 * Columns confirmed (2026-07-29 restore drill, production data) to be
 * NOT NULL jsonb columns that can legitimately hold the JSON null literal --
 * e.g. data_recovery_changes.old_value for a FULLHISTORY_REBUILD "inserted"
 * row, where there genuinely was no prior value. PostgREST's insert endpoint
 * cannot represent that distinction: a JSON null in the request body is
 * always coerced to SQL NULL, which then violates the NOT NULL constraint.
 * 94% of production data_recovery_changes rows hit this (29,349/31,132), so
 * retrying one row at a time would need tens of thousands of sequential
 * network round trips. If a future drill finds another table/column with
 * the same failure signature, add it here rather than reverting to the slow
 * generic retry path for the whole table.
 */
export const NOT_NULL_JSONB_NULL_LITERAL_COLUMNS: Record<string, string[]> = {
  data_recovery_changes: ["old_value", "new_value"],
};

export const JSONB_NULL_LITERAL_SENTINEL = { __restored_jsonb_null__: true };

function substituteJsonbNullLiterals(table: string, row: JsonRow): { row: JsonRow; changed: boolean } {
  const columns = NOT_NULL_JSONB_NULL_LITERAL_COLUMNS[table];
  if (!columns) return { row, changed: false };
  let changed = false;
  const next: JsonRow = { ...row };
  for (const column of columns) {
    if (next[column] === null) {
      next[column] = JSONB_NULL_LITERAL_SENTINEL;
      changed = true;
    }
  }
  return { row: changed ? next : row, changed };
}

/**
 * Inserts every table's rows from a backup bundle into the target client, in
 * BACKUP_TABLES order so foreign keys resolve (parent tables restored before
 * the children that reference them). The caller is responsible for having
 * already validated the target via assertSafeRestoreTarget and for creating
 * targetClient from RESTORE_TARGET_* variables only.
 *
 * Known NOT-NULL-jsonb-null-literal columns are substituted with a documented
 * sentinel before the first insert attempt (see
 * NOT_NULL_JSONB_NULL_LITERAL_COLUMNS), so the common case succeeds in one
 * batch call. For anything else, a batch failure falls back to retrying one
 * row at a time so a single unexpected bad row does not cost every other row
 * in the same batch. Failing rows are recorded in `skipped` with the exact
 * error, never silently dropped, and restoring continues with the next table
 * rather than aborting the whole run.
 */
export async function restoreBundleToTarget(
  bundle: BackupBundle,
  targetClient: SupabaseClient,
  tables: readonly string[] = BACKUP_TABLES,
  batchSize = 500,
): Promise<RestoreTableResult[]> {
  const results: RestoreTableResult[] = [];
  for (const table of tables) {
    const rawRows = bundle.tables[table]?.rows || [];
    let inserted = 0;
    let substituted = 0;
    const skipped: Array<{ row: JsonRow; error: string }> = [];

    const rows = rawRows.map(row => {
      const result = substituteJsonbNullLiterals(table, row);
      if (result.changed) substituted += 1;
      return result.row;
    });

    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      const { error } = await targetClient.from(table).insert(batch);
      if (!error) {
        inserted += batch.length;
        continue;
      }
      for (const row of batch) {
        const single = await targetClient.from(table).insert([row]);
        if (single.error) {
          skipped.push({ row, error: single.error.message });
        } else {
          inserted += 1;
        }
      }
    }
    results.push({ table, inserted, skipped, substituted });
  }
  return results;
}
