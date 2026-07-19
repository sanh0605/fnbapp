export type Category = "KEEP_AUDIT" | "KEEP_RUNBOOK" | "KEEP_MIGRATION_HISTORY" | "DELETE_ONE_OFF" | "ARCHIVE_DOC_ONLY";

const AUDIT_PREFIXES = ["audit-", "check-"];
const RUNBOOK_KEYWORDS = ["reprocess", "restore", "reaudit", "rename-v1", "reset-v2", "init-", "standalone-sheets-utils", "batch-sheets-utils", "create-v2-sheets", "backup-v1", "reconcile-v1-v2", "reconcile-migrated"];
const MIGRATION_KEYWORDS = ["migrate", "remigrate", "batch-migrate", "re-migrate"];
// Per docs/FILE-ORGANIZATION.md: "lock-*/recover-* (cohort lock/recovery runbooks
// tied to a specific incident, same disposition as migrations)".
const COHORT_LOCK_RECOVERY_KEYWORDS = ["lock-", "recover-"];
const ONE_OFF_KEYWORDS = ["investigate", "fix-", "find-", "verify-", "test-", "debug-", "check-", "spot", "diagnose", "diff-", "classify-"];
const ARCHIVE_KEYWORDS = ["add-column", "add-snapshot", "add-line", "add-transaction", "add-unit", "apply-", "backfill-", "clear-", "cleanup-", "delete-", "patch", "rename", "update-btp", "update-po-headers", "update-inventory", "zero-out"];

export function categorize(name: string): { category: Category; reason: string } {
  // Specific recent additions for Dao Mieng work
  if (name === "audit-dao-mieng-report-cogs.ts" || name === "verify-cogs-allocation-impact.ts" || name === "spotcheck-mod004.ts") {
    return { category: "ARCHIVE_DOC_ONLY", reason: "Dao Mieng investigation scripts, kept as reference; bug now fixed" };
  }
  if (name === "audit-negative-periods-classification.ts" || name === "audit-void-orders.ts" || name === "audit-stock-ledger-schema.ts" || name === "audit-stock-adjustments.ts" || name === "audit-order-total-consistency.ts" || name === "audit-po-save-ledger.ts") {
    return { category: "KEEP_AUDIT", reason: "Phase 2-4 audit scripts from Claude code session" };
  }

  if (AUDIT_PREFIXES.some(p => name.startsWith(p))) {
    return { category: "KEEP_AUDIT", reason: "Audit script — referenced in roadmap" };
  }

  for (const keyword of RUNBOOK_KEYWORDS) {
    if (name.includes(keyword)) {
      return { category: "KEEP_RUNBOOK", reason: `Reusable operation (${keyword})` };
    }
  }

  for (const keyword of MIGRATION_KEYWORDS) {
    if (name.includes(keyword)) {
      return { category: "KEEP_MIGRATION_HISTORY", reason: "Migration script preserved as historical record" };
    }
  }

  for (const keyword of COHORT_LOCK_RECOVERY_KEYWORDS) {
    if (name.startsWith(keyword)) {
      return {
        category: "KEEP_MIGRATION_HISTORY",
        reason: "Cohort lock/recovery runbook tied to a specific incident, same disposition as migrations",
      };
    }
  }

  for (const keyword of ONE_OFF_KEYWORDS) {
    if (name.includes(keyword)) {
      return { category: "DELETE_ONE_OFF", reason: `One-off investigation/fix (${keyword})` };
    }
  }

  for (const keyword of ARCHIVE_KEYWORDS) {
    if (name.includes(keyword)) {
      return { category: "ARCHIVE_DOC_ONLY", reason: `One-off data fix (${keyword}) — keep for audit trail, not for re-run` };
    }
  }

  return { category: "DELETE_ONE_OFF", reason: "Unclassified — default to one-off" };
}
