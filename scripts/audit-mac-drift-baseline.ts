/**
 * Cohort-aware MAC drift audit.
 *
 * Production access is read-only. The script reads operational tables and
 * audit_baseline_locks, then writes one date-stamped local JSON artifact.
 */

import * as dotenv from "dotenv";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { auditMacCogsDrift } from "../lib/mac-cogs-audit";
import {
  buildMacDriftAuditOutputPath,
  classifyMacDriftMismatches,
  FROZEN_MAC_DRIFT_BASELINE_PATH,
  LOCKED_VIOLATION_SUBCATEGORIES,
  MAC_DRIFT_AUDIT_CATEGORIES,
  type KnownMacDriftCohortArtifact,
  type MacDriftBaselineLock,
} from "../lib/mac-drift-baseline";

dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";

const APPROVED_FROZEN_BASELINE_SHA256 =
  "cd0a2b13d6e52cf7cd53dd8223b805686c7fa579ef76a245a588d484fe630dc3";
const KNOWN_COHORT_PATHS = [
  "docs/audits/2026-07-15-task-3.4-outside-cohort-investigation.json",
  "docs/audits/2026-07-15-task-3.6-forward-drift-investigation.json",
  "docs/audits/2026-07-16-task-3.8-backdated-events-surface.json",
] as const;
const PAGE_SIZE = 1000;

type Row = Record<string, unknown>;
type KnownArtifactJson = {
  lines?: Array<{ line_id?: string }>;
};

function fmtMoney(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value).toLocaleString("vi-VN")} VND`;
}

async function main(): Promise<void> {
  const generatedAt = new Date();
  const reportPath = buildMacDriftAuditOutputPath(generatedAt);
  const frozenBaselineHash = sha256(readFileSync(FROZEN_MAC_DRIFT_BASELINE_PATH));
  if (frozenBaselineHash !== APPROVED_FROZEN_BASELINE_SHA256) {
    throw new Error(
      `Frozen baseline artifact SHA-256 mismatch: expected ${APPROVED_FROZEN_BASELINE_SHA256}, got ${frozenBaselineHash}`,
    );
  }

  const { findAllNoCache } = await import("../lib/sheets_db");
  const { getSupabaseClient } = await import("../lib/supabase");
  const [orders, lines, ledger, recipes, semiProducts, locks] = await Promise.all([
    findAllNoCache("Orders_V2"),
    findAllNoCache("Order_Lines_V2"),
    findAllNoCache("Stock_Ledger"),
    findAllNoCache("Recipes"),
    findAllNoCache("Semi_Products"),
    selectAllLocks(getSupabaseClient()),
  ]);

  const liveLineIds = new Set(lines.map(line => String(line.id || "")));
  const missingLockedLineIds = locks
    .map(lock => lock.order_line_id)
    .filter(lineId => !liveLineIds.has(lineId));
  if (missingLockedLineIds.length > 0) {
    throw new Error(
      `Audit lock integrity failure: ${missingLockedLineIds.length} locked line IDs are missing from Order_Lines_V2: ${missingLockedLineIds.slice(0, 10).join(", ")}`,
    );
  }

  const knownCohortArtifacts = KNOWN_COHORT_PATHS.map(loadKnownCohortArtifact);
  const drift = auditMacCogsDrift({
    orders: orders as any[],
    lines: lines as any[],
    ledger: ledger as any[],
    recipes: recipes as any[],
    semiProducts: semiProducts as any[],
  });
  const classified = classifyMacDriftMismatches({
    mismatches: drift.lineMismatches,
    locks,
    knownCohortArtifacts,
  });
  const classifiedTotal = Object.values(classified.summary)
    .reduce((total, count) => total + count, 0);
  if (classifiedTotal !== drift.lineMismatches.length) {
    throw new Error(
      `Classification reconciliation failed: ${classifiedTotal} classified vs ${drift.lineMismatches.length} mismatches`,
    );
  }

  const lockedViolations = classified.lines.filter(
    line => line.audit_category === "LOCKED_VIOLATION",
  );
  const newInvestigationNeeded = classified.lines.filter(
    line => line.audit_category === "NEW_INVESTIGATION_NEEDED",
  );
  const knownNotLocked = classified.lines.filter(
    line => line.audit_category === "KNOWN_NOT_LOCKED",
  );
  const securityIntegrityClean =
    classified.lockedViolationSummary.LOCKED_VIOLATION_STORED === 0;
  const auditClean = lockedViolations.length === 0 && newInvestigationNeeded.length === 0;

  writeJsonReport(reportPath, {
    generated_at: generatedAt.toISOString(),
    mode: "READ_ONLY",
    contract: {
      database_tables_read: [
        "Orders_V2",
        "Order_Lines_V2",
        "Stock_Ledger",
        "Recipes",
        "Semi_Products",
        "audit_baseline_locks",
      ],
      database_mutation_methods_used: [],
      frozen_artifact: FROZEN_MAC_DRIFT_BASELINE_PATH,
      frozen_artifact_sha256: frozenBaselineHash,
      output_path: reportPath,
    },
    known_cohort_artifacts: knownCohortArtifacts.map(artifact => ({
      path: artifact.path,
      source_hash: artifact.sourceHash,
      line_count: artifact.lineIds.size,
    })),
    summary: {
      audit_clean: auditClean,
      security_integrity_clean: securityIntegrityClean,
      total_live_mismatches: drift.lineMismatches.length,
      total_live_delta_vnd: drift.totalDelta,
      mismatch_line_delta_vnd: sum(classified.lines.map(line => line.delta)),
      total_locks: locks.length,
      missing_locked_line_count: 0,
      by_category: classified.summary,
      locked_violation_by_subcategory: classified.lockedViolationSummary,
    },
    locked_violations: lockedViolations,
    new_investigation_needed: newInvestigationNeeded,
    known_not_locked: knownNotLocked,
    locked_matched_cohort_breakdown: classified.cohortBreakdown,
    lines: classified.lines,
  });

  console.log("=== COHORT-AWARE MAC DRIFT AUDIT (READ ONLY) ===");
  console.log(`Total live mismatches:       ${drift.lineMismatches.length}`);
  console.log(`Mismatch-line delta:         ${fmtMoney(sum(classified.lines.map(line => line.delta)))}`);
  console.log(`Audit baseline locks:        ${locks.length}`);
  for (const category of MAC_DRIFT_AUDIT_CATEGORIES) {
    console.log(`${category.padEnd(29)} ${classified.summary[category]}`);
  }
  for (const category of LOCKED_VIOLATION_SUBCATEGORIES) {
    console.log(`  ${category.padEnd(27)} ${classified.lockedViolationSummary[category]}`);
  }
  console.log(`Security integrity:          ${securityIntegrityClean ? "CLEAN" : "CRITICAL"}`);
  console.log(`Audit status:                ${auditClean ? "AUDIT CLEAN" : "FOLLOW-UP REQUIRED"}`);
  console.log(`JSON artifact:               ${reportPath}`);

  if (lockedViolations.length > 0) {
    console.log("\nLocked violations");
    for (const line of lockedViolations) {
      console.log(
        `${line.locked_violation_subcategory} | ${line.line_id} | ${line.order_no} | fields=${line.violation_fields?.join(",")} | delta=${fmtMoney(line.delta)}`,
      );
    }
  }
  if (newInvestigationNeeded.length > 0) {
    console.log("\nNew investigation needed");
    for (const line of newInvestigationNeeded.slice(0, 50)) {
      console.log(
        `${line.line_id} | ${line.order_no} | ${line.product_id} | ${line.created_at} | delta=${fmtMoney(line.delta)}`,
      );
    }
  }
  console.log("\nNo database rows were written.");
}

async function selectAllLocks(client: SupabaseClient): Promise<MacDriftBaselineLock[]> {
  const rows: MacDriftBaselineLock[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from("audit_baseline_locks")
      .select("order_line_id,reason,source_hash,stored_cost_at_sale,expected_cost_at_sale")
      .order("order_line_id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as MacDriftBaselineLock[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function loadKnownCohortArtifact(path: string): KnownMacDriftCohortArtifact {
  const bytes = readFileSync(path);
  const artifact = JSON.parse(bytes.toString("utf8")) as KnownArtifactJson;
  if (!Array.isArray(artifact.lines)) {
    throw new Error(`Known cohort artifact has no lines array: ${path}`);
  }
  const lineIds = new Set(
    artifact.lines
      .map(line => String(line.line_id || "").trim())
      .filter(Boolean),
  );
  if (lineIds.size === 0) {
    throw new Error(`Known cohort artifact has no line IDs: ${path}`);
  }
  return { path, sourceHash: sha256(bytes), lineIds };
}

function writeJsonReport(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
