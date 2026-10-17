// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// BR-UI-005 (F13): every error box on every screen uses the shared Alert
// (components/ui/Alert.tsx) with variant "danger".
function findTsxFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("error box guard (BR-UI-005, F13)", () => {
  it("every error box uses the shared Alert", () => {
    const root = process.cwd();
    const appFiles = findTsxFiles(join(root, "app"));
    const componentFiles = findTsxFiles(join(root, "components"));
    const files = [...appFiles, ...componentFiles];

    const violations: string[] = [];

    for (const file of files) {
      const rel = relative(root, file).replace(/\\/g, "/");

      if (rel.endsWith(".test.tsx")) continue;
      if (rel.startsWith("app/pos/")) continue;
      if (rel === "components/ui/Badge.tsx") continue;
      if (rel === "components/ui/Alert.tsx") continue;

      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      if (lines.some((line) => line.includes("bg-danger/10") && line.includes("border-danger/20"))) {
        violations.push(rel);
      }
    }

    expect(violations, "Error boxes must use the shared Alert (BR-UI-005, F13)").toEqual([]);
  });
});
