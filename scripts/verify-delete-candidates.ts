/**
 * Phase 6.2: Verify DELETE_ONE_OFF script safety.
 *
 * For each script in DELETE_ONE_OFF category (from script-cleanup-plan.md):
 * 1. Check if file still exists.
 * 2. Grep codebase for references (excluding the script itself + cleanup plan + tracking docs).
 * 3. Flag if referenced anywhere meaningful.
 *
 * Output: docs/audits/2026-06-27-script-deletion-verification.md
 *
 * Claude code — Phase 6.2 read-only audit.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const REPO_ROOT = process.cwd();
const SCRIPTS_DIR = path.join(REPO_ROOT, "scripts");

const DELETE_ONE_OFF = [
  "add-non-inventory-column.ts",
  "archive-review-sheet-candidates.ts",
  "archive-sheet-candidates.ts",
  "batch-sheets-orders.ts",
  "classify-order-ledger-audit.ts",
  "classify-orphan-order-ledger.ts",
  "classify-promo-context.ts",
  "cleanup-test-orders-v2.ts",
  "compare-order-dates.js",
  "diff-promo-id-loss.ts",
  "find-promo-plus-order-discount.ts",
  "find-promo-undercount-bugs.ts",
  "find-revenue-anomalies-broad.ts",
  "fix-historical-discounts.ts",
  "fix-phd000522-promo.ts",
  "fix-phd522-and-uck161.ts",
  "fix-product-discount-overrides.ts",
  "fix-subtotal-and-line-discounts.ts",
  "fix-ws7-migration-issues.ts",
  "generate-knowledge-graph.ts",
  "generate-phase3-briefing.ts",
  "inspect-lines.ts",
  "inspect-order-v2.ts",
  "inspect-phd000522.ts",
  "inspect-uck000094.ts",
  "inspect-uck000161.ts",
  "inspect.ts",
  "investigate-caphe-da-detail.ts",
  "investigate-caphe-da.ts",
  "investigate-dao-mieng.ts",
  "investigate-negative-stock.ts",
  "investigate-pnl-bugs.ts",
  "investigate-revenue-anomaly.ts",
  "investigate-revenue-mismatch.ts",
  "investigate-topping-cogs.ts",
  "list-all-v2-orders.ts",
  "read-user-sheet.ts",
  "recover-product-discount.ts",
  "seed-admin.js",
  "sync-supabase-sales.js",
  "test-edit-order-v2.ts",
  "test-pnl-v2.ts",
  "test-submit-order-v2.ts",
  "test-void-order-v2.ts",
  "verify-e1-fix.ts",
  "verify-june-revenue.ts",
  "verify-latest-test-order.ts",
  "verify-orders-schema.ts",
  "verify-pnl-patterns.ts",
  "verify-v2-invariants.ts",
  "verify-v2-schema.ts",
];

function walkDir(dir: string, results: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, results);
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function findReferences(scriptName: string): string[] {
  const refs: string[] = [];
  const allFiles = walkDir(REPO_ROOT);
  const excludePatterns = [
    /^scripts\/verify-delete-candidates\.ts$/,
    /^scripts\/script-name-placeholder$/, // never match
  ];
  // Substantive reference patterns: imports, script-path strings, command lines.
  const refPatterns = [
    new RegExp(`from\\s+['"]\\.\\./${scriptName.replace(/\./g, "\\.")}['"]`),
    new RegExp(`from\\s+['"]\\./${scriptName.replace(/\./g, "\\.")}['"]`),
    new RegExp(`require\\(['"]\\.\\./${scriptName.replace(/\./g, "\\.")}['"]\\)`),
    new RegExp(`require\\(['"]\\./${scriptName.replace(/\./g, "\\.")}['"]\\)`),
    new RegExp(`scripts/${scriptName.replace(/\./g, "\\.")}`),
    new RegExp(`node_modules/.bin/vite-node\\.cmd scripts\\s+${scriptName.replace(/\./g, "\\.")}`),
    new RegExp(`\\.bin/vite-node\\.cmd\\s+${scriptName.replace(/\./g, "\\.")}`),
    new RegExp(`vite-node\\.\\w+\\s+${scriptName.replace(/\./g, "\\.")}`),
  ];

  for (const file of allFiles) {
    const relPath = path.relative(REPO_ROOT, file).split(path.sep).join("/");
    if (relPath === `scripts/${scriptName}`) continue;
    if (excludePatterns.some(p => p.test(relPath))) continue;
    // Skip noise: build cache, lock files, audit JSONs, generated reports.
    if (relPath === "tsconfig.tsbuildinfo") continue;
    if (relPath.endsWith(".lock")) continue;
    if (relPath === "package-lock.json") continue;
    if (relPath === "docs/audits/sheet-usage-report.json") continue;
    if (relPath === "docs/audits/2026-06-26-folder-cleanup-proposal.md") continue;
    if (relPath === "docs/audits/script-cleanup-plan.md") continue;
    if (relPath === "docs/audits/2026-06-27-script-deletion-verification.md") continue;
    if (relPath === "DEVELOPMENT-TRACKING.md") continue;
    if (relPath === "docs/audits/codex-handoff-2026-06-25.md") continue;
    if (relPath === "docs/audits/2026-06-25-full-system-audit-roadmap.md") continue;

    try {
      const content = fs.readFileSync(file, "utf8");
      if (refPatterns.some(p => p.test(content))) {
        refs.push(relPath);
      }
    } catch {
      // Binary file, skip.
    }
  }
  return refs;
}

function main() {
  const lines: string[] = [];
  lines.push("# Phase 6.2 — Script Deletion Verification");
  lines.push("");
  lines.push(`Date: 2026-06-27`);
  lines.push(`Generated by: scripts/verify-delete-candidates.ts`);
  lines.push("");
  lines.push(`Audited ${DELETE_ONE_OFF.length} DELETE_ONE_OFF scripts.`);
  lines.push("");

  const safe: string[] = [];
  const referenced: Array<{ script: string; refs: string[] }> = [];
  const missing: string[] = [];

  for (const script of DELETE_ONE_OFF) {
    const fullPath = path.join(SCRIPTS_DIR, script);
    if (!fs.existsSync(fullPath)) {
      missing.push(script);
      continue;
    }
    const refs = findReferences(script);
    if (refs.length === 0) {
      safe.push(script);
    } else {
      referenced.push({ script, refs });
    }
  }

  lines.push(`## Summary`);
  lines.push("");
  lines.push(`| Status | Count |`);
  lines.push(`|---|---|`);
  lines.push(`| Safe to delete (no references) | ${safe.length} |`);
  lines.push(`| Referenced elsewhere (review needed) | ${referenced.length} |`);
  lines.push(`| Already deleted (file not found) | ${missing.length} |`);
  lines.push("");

  lines.push(`## Safe to delete (${safe.length})`);
  lines.push("");
  for (const s of safe) {
    lines.push(`- \`${s}\``);
  }
  lines.push("");

  if (referenced.length > 0) {
    lines.push(`## Referenced elsewhere — REVIEW NEEDED (${referenced.length})`);
    lines.push("");
    for (const { script, refs } of referenced) {
      lines.push(`### \`${script}\``);
      for (const r of refs) {
        lines.push(`- ${r}`);
      }
      lines.push("");
    }
  }

  if (missing.length > 0) {
    lines.push(`## Already deleted (${missing.length})`);
    lines.push("");
    for (const s of missing) {
      lines.push(`- \`${s}\``);
    }
    lines.push("");
  }

  const outputPath = path.join(REPO_ROOT, "docs/audits/2026-06-27-script-deletion-verification.md");
  fs.writeFileSync(outputPath, lines.join("\n"));
  console.log(`Output: ${path.relative(REPO_ROOT, outputPath)}`);
  console.log(`Safe: ${safe.length}, Referenced: ${referenced.length}, Missing: ${missing.length}`);
}

main();
