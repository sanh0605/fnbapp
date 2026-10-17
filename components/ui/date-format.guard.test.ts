import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// BR-DATA-006 (owner 2026-09-29): Outside a filter, every date shows as
// dd/mm/yyyy HH:mm:ss. A value that stores only a day ("2026-09-28") shows
// 28/09/2026 00:00:00 via formatDateTimeFull.
//
// Scanned: every .ts/.tsx under app, components and lib, tests excluded;
// lib/shared/datetime.ts defines the helpers, so it is skipped.
// Fails when a line calls formatDate(, formatDateTime(, formatTime( (a clock
// time with no date), formatVnDay( or formatVnDayWithWeekday( (a bare day)
// unless the file and line text match the allowlist, and when a file imports
// any of them other than the one helper its allowlist entry calls (an alias or
// .map(formatDate) has no call).

interface AllowedCall {
  file: string;
  pattern: string;
  reason: string;
}

const ALLOWLIST: AllowedCall[] = [
  {
    file: "app/pos/components/POSScreen.tsx",
    pattern: "formatDate(new Date())",
    reason: "the till header shows only today",
  },
  {
    file: "components/ui/DayInput.tsx",
    pattern: "formatVnDay(",
    reason: "the date picker's own text box; an input shows a day only (BR-DATA-006)",
  },
  {
    file: "app/admin/finance/components/CashBookClient.tsx",
    pattern: "formatVnDay(resolvedRange.",
    reason: "the filter range label; a filter shows a bare day",
  },
  {
    file: "app/admin/reports/sales/components/SalesByDaySection.tsx",
    pattern: "formatVnDay(d.label)",
    reason: "whole-day row; listed under Not yet in BR-DATA-006, waiting for the owner",
  },
  {
    file: "app/admin/components/DashboardView.tsx",
    pattern: "formatVnDayWithWeekday(row.day)",
    reason: "the 7-day table's whole-day row, same reason as SalesByDaySection; the stocktake alert stays guarded",
  },
];

const HELPERS_FILE = "lib/shared/datetime.ts";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    if ((!name.endsWith(".tsx") && !name.endsWith(".ts")) || name.includes(".test.") || name.endsWith(".d.ts")) {
      return [];
    }
    return [full];
  });
}

function stripBlockComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    const count = (match.match(/\n/g) || []).length;
    return "\n".repeat(count);
  });
}

const root = process.cwd();
const files = ["app", "components", "lib"]
  .flatMap((dir) => sources(join(root, dir)))
  .map((f) => ({
    path: relative(root, f).split(sep).join("/"),
    src: readFileSync(f, "utf8"),
  }))
  .filter((f) => f.path !== HELPERS_FILE);

// Block and line comments gone, line count kept so line numbers stay true.
function stripComments(src: string): string {
  return stripBlockComments(src)
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|[^:"'`])\/\/.*$/, "$1"))
    .join("\n");
}

const CALL_REGEX = /\bformat(?:Date(?:Time)?|Time|VnDay(?:WithWeekday)?)\(/;
const IMPORT_REGEX = /(?:import|export)\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["'](?:@\/lib\/shared\/|\.\/)datetime["']/g;
const BANNED_NAMES = new Set(["formatDate", "formatDateTime", "formatTime", "formatVnDay", "formatVnDayWithWeekday"]);

// Whole names inside the import braces, as written before any "as".
function bannedImports(src: string): string[] {
  return [...stripComments(src).matchAll(IMPORT_REGEX)]
    .flatMap((m) => m[1].split(","))
    .map((name) => name.trim().split(/\s+as\s+/)[0])
    .filter((name) => BANNED_NAMES.has(name));
}

function isAllowed(path: string, code: string): boolean {
  return ALLOWLIST.some((entry) => path === entry.file && code.includes(entry.pattern));
}

function offenders(): string[] {
  const out: string[] = [];
  for (const f of files) {
    stripComments(f.src).split("\n").forEach((code, idx) => {
      if (!CALL_REGEX.test(code)) return;
      if (isAllowed(f.path, code)) return;

      const lineNum = idx + 1;
      out.push(
        `${f.path}:${lineNum}: BR-DATA-006: show dates with formatDateTimeFull (dd/mm/yyyy HH:mm:ss); only filters show a bare day`,
      );
    });
  }
  return out.sort();
}

function importOffenders(): string[] {
  // an allowed file may import only the helper its own entry calls
  const importAllowed = new Set(ALLOWLIST.map((entry) => `${entry.file}:${entry.pattern.split("(")[0]}`));
  return files
    .flatMap((f) =>
      bannedImports(f.src)
        .filter((name) => !importAllowed.has(`${f.path}:${name}`))
        .map((name) => `${f.path}: BR-DATA-006: imports ${name}; import formatDateTimeFull instead`),
    )
    .sort();
}

describe("every date outside a filter shows with formatDateTimeFull (BR-DATA-006)", () => {
  it("no calls to the banned date helpers outside allowlist", () => {
    expect(offenders()).toEqual([]);
  });

  it("no file outside the allowlist imports a banned date helper", () => {
    expect(importOffenders()).toEqual([]);
  });

  it("every allowlist entry still matches a line in its file (no stale entries)", () => {
    for (const entry of ALLOWLIST) {
      const file = files.find((f) => f.path === entry.file);
      expect(stripComments(file?.src ?? "").includes(entry.pattern), `${entry.file} no longer contains: ${entry.pattern}`).toBe(true);
    }
  });

  it("the scan reads real files (not a vacuous pass)", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => f.path === "app/pos/components/POSScreen.tsx")).toBe(true);
    expect(files.some((f) => f.path === "app/admin/finance/components/CashBookClient.tsx")).toBe(true);
    expect(files.some((f) => f.path === "lib/purchasing/purchase-order-cancel.ts")).toBe(true);
    expect(files.some((f) => f.path === HELPERS_FILE)).toBe(false);
  });

  it("regex excludes formatDateTimeFull", () => {
    expect(CALL_REGEX.test("formatDateTimeFull(val)")).toBe(false);
    expect(CALL_REGEX.test("formatDate(val)")).toBe(true);
    expect(CALL_REGEX.test("formatDateTime(val)")).toBe(true);
    expect(CALL_REGEX.test("formatTime(val, true)")).toBe(true);
  });

  it("regex catches both whole-day helpers, not parseVnDay", () => {
    expect(CALL_REGEX.test("formatVnDay(val)")).toBe(true);
    expect(CALL_REGEX.test("formatVnDayWithWeekday(val)")).toBe(true);
    expect(CALL_REGEX.test("parseVnDay(val)")).toBe(false);
  });

  it("DashboardView's stocktake alert stays guarded while its 7-day row is allowed", () => {
    const dash = "app/admin/components/DashboardView.tsx";
    expect(isAllowed(dash, "{formatVnDayWithWeekday(row.day)}")).toBe(true);
    expect(isAllowed(dash, "formatVnDay(data.stocktake.stale.lastConfirmedDay)")).toBe(false);
    expect(isAllowed(dash, "formatVnDayWithWeekday(session.openedAt)")).toBe(false);
  });

  it("import matcher catches an alias or a multi-line list, and ignores other names", () => {
    const imp = (names: string, kw = "import", from = "@/lib/shared/datetime") => `${kw} {${names}} from "${from}";`;
    expect(bannedImports(imp(" formatDate as x "))).toEqual(["formatDate"]);
    expect(bannedImports(imp("\n  formatDateTimeFull,\n  formatDateTime,\n"))).toEqual(["formatDateTime"]);
    expect(bannedImports(imp(" formatDateTimeFull, formatDateTimeShort, parseVnDay "))).toEqual([]);
    expect(bannedImports(imp(" formatVnDay, formatVnDayWithWeekday as w "))).toEqual(["formatVnDay", "formatVnDayWithWeekday"]);
    // a re-export and the same-folder spelling are imports too; a commented-out import is not
    expect(bannedImports(imp(" formatDate as x ", "export"))).toEqual(["formatDate"]);
    expect(bannedImports(imp(" formatDate ", "import", "./datetime"))).toEqual(["formatDate"]);
    expect(bannedImports(`// ${imp(" formatDate ")}`)).toEqual([]);
    expect(bannedImports(imp("\n  formatDateTimeFull, // formatDate\n"))).toEqual([]);
  });
});
