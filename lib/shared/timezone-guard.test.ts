import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Owner, 2026-10-04: the same time-zone bug shipped four times (commits
// 7bc58b5e, 32238270, b719fe86 and this audit). Every day and clock time must
// be Asia/Saigon wherever the code runs (Vercel runs on UTC). This scan refuses
// the patterns that read the runtime's own zone, outside a short allowlist.
// BR-DATA-006.

const ROOTS = ["app", "lib", "components", "scripts"];
const SKIP_DIRS = new Set(["node_modules", ".next"]);

type Pattern = { id: string; label: string; test: (line: string) => boolean; needsTimeZoneWindow?: boolean };

const PATTERNS: Pattern[] = [
  {
    id: "P1",
    label: "new Date(`${...}T...`) -- date string built without Z or an offset",
    test: l => /new Date\(`\$\{[^}]*\}T/.test(l),
  },
  {
    id: "P2",
    label: "local-clock getter/setter (getFullYear/getMonth/getDate/getDay/getHours/getMinutes/setHours/setDate/setMonth/setFullYear)",
    test: l => /\.(getFullYear|getMonth|getDate|getDay|getHours|getMinutes|setHours|setDate|setMonth|setFullYear)\(/.test(l),
  },
  {
    id: "P3",
    label: "toISOString() used as a day (slice(0, 10|16) or split(\"T\"))",
    test: l => /toISOString\(\)\.slice\(\s*0\s*,\s*(10|16)\s*\)/.test(l) || /toISOString\(\)\.split\(\s*["']T["']\s*\)/.test(l),
  },
  {
    id: "P4",
    label: "toLocaleDateString/toLocaleTimeString/Date.toLocaleString without timeZone",
    test: l => /\.toLocaleDateString\(|\.toLocaleTimeString\(|new Date\([^)]*\)\.toLocaleString\(/.test(l),
    needsTimeZoneWindow: true,
  },
];

// Each entry names the file AND the line content, so an allowlisted file
// cannot hide a new bad line.
const ALLOWLIST: Array<{ file: string; contains: string; reason: string }> = [
  {
    file: "lib/shared/date-range-presets.ts",
    contains: "d.toISOString().slice(0, 10)",
    reason: "date built with Date.UTC: pure calendar arithmetic, no zone involved",
  },
  {
    file: "app/admin/inventory/assets/actions.ts",
    contains: "saigonNow.toISOString().slice(0, 10)",
    reason: "now shifted by +7h first, then the UTC day is read: that is the Saigon day",
  },
  {
    file: "scripts/verify-revenue-core.ts",
    contains: ".getDate(); // day 0 of next month",
    reason: "days in a month: new Date(y, m, 0).getDate() is the same in every zone",
  },
  {
    file: "scripts/verify-revenue-core.ts",
    contains: "new Date(Number(year), Number(month), 0).getDate()",
    reason: "days in a month: the same in every zone",
  },
  {
    file: "scripts/verify-restore-drill.ts",
    contains: "fnbapp-restore-drill-${new Date().toISOString().slice(0, 10)}.json",
    reason: "a temp file name, not a business day",
  },
  {
    file: "components/ui/picker-date.ts",
    contains: "d.getFullYear()",
    reason: "picker calendar-day round trip: local fields in, local fields out, same in every zone",
  },
  {
    file: "components/ui/picker-date.ts",
    contains: "d.getMonth()",
    reason: "picker calendar-day round trip: local fields in, local fields out, same in every zone",
  },
  {
    file: "components/ui/picker-date.ts",
    contains: "d.getDate()",
    reason: "picker calendar-day round trip: local fields in, local fields out, same in every zone",
  },
  ...["d.getFullYear()", "d.getMonth() + 1", "d.getDate()", "d.getHours()", "d.getMinutes()"].map(contains => ({
    file: "components/ui/SaigonDateTimeInput.tsx",
    contains,
    reason: "picker wall-clock round trip (2026-10-05): local fields in, local fields out, same in every zone; its test passes under TZ=UTC",
  })),
];

function listSources(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSources(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\./.test(entry)) {
      out.push(full);
    }
  }
}

type Hit = { file: string; line: number; pattern: string; text: string };

export function scanSource(file: string, content: string): Hit[] {
  const lines = content.split(/\r?\n/);
  const hits: Hit[] = [];
  lines.forEach((text, i) => {
    for (const p of PATTERNS) {
      if (!p.test(text)) continue;
      if (p.needsTimeZoneWindow) {
        const window = lines.slice(i, i + 7).join("\n");
        if (/timeZone/.test(window)) continue;
      }
      hits.push({ file, line: i + 1, pattern: `${p.id} ${p.label}`, text: text.trim() });
    }
  });
  return hits;
}

function isAllowed(hit: Hit): boolean {
  return ALLOWLIST.some(a => a.file === hit.file && hit.text.includes(a.contains));
}

describe("time-zone guard", () => {
  it("flags each risky pattern and lets timeZone / numbers through", () => {
    expect(scanSource("x.ts", "new Date(`${d}T00:00:00`)")).toHaveLength(1);
    expect(scanSource("x.ts", "d.getHours()")).toHaveLength(1);
    expect(scanSource("x.ts", "d.getUTCHours()")).toHaveLength(0);
    expect(scanSource("x.ts", "x.toISOString().slice(0, 10)")).toHaveLength(1);
    expect(scanSource("x.ts", "x.toISOString().split(\"T\")[0]")).toHaveLength(1);
    expect(scanSource("x.ts", "d.toLocaleDateString(\"vi-VN\")")).toHaveLength(1);
    expect(scanSource("x.ts", "d.toLocaleDateString(\"vi-VN\", {\n timeZone: \"Asia/Ho_Chi_Minh\" })")).toHaveLength(0);
    expect(scanSource("x.ts", "(1234).toLocaleString(\"vi-VN\")")).toHaveLength(0);
  });

  it("every allowlist entry still matches a real line (no stale entries)", () => {
    for (const a of ALLOWLIST) {
      const content = readFileSync(resolve(a.file), "utf8");
      expect(content.includes(a.contains), `${a.file} no longer contains: ${a.contains}`).toBe(true);
    }
  });

  it("no source reads the runtime's own time zone for a day or a clock time", () => {
    const repoRoot = resolve(__dirname, "..", "..");
    const files: string[] = [];
    for (const root of ROOTS) listSources(join(repoRoot, root), files);

    const bad: Hit[] = [];
    for (const full of files) {
      const rel = relative(repoRoot, full).split(sep).join("/");
      for (const hit of scanSource(rel, readFileSync(full, "utf8"))) {
        if (!isAllowed(hit)) bad.push(hit);
      }
    }

    const message = bad
      .map(h => `${h.file}:${h.line}  [${h.pattern}]  ${h.text}`)
      .join("\n");
    expect(
      bad,
      `Time-zone risk found (use lib/shared/datetime.ts or lib/shared/report-time.ts):\n${message}`,
    ).toEqual([]);
  });
});
