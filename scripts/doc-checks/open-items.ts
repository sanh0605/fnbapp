/**
 * Open-items generator (spec section 3.8). OPEN-ITEMS.md is machine-owned: it is
 * derived from `it.todo(...)` tests via `vitest run --reporter=json`, filtered to
 * assertions whose status is "todo". A .todo test does NOT fail `vitest run`
 * (exit 0), so CLAUDE.md section 9's all-green bar survives.
 *
 * The pure renderer is unit-tested in open-items-core.test.ts; the JSON parsing
 * and child-process work live in the CLI at the bottom, guarded so importing this
 * module (from the test) does not run it.
 */
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { tmpdir } from "node:os";

export function renderOpenItems(todos: { title: string; file: string }[]): string {
  const head = "# Việc đang làm (sinh tự động từ it.todo — đừng sửa tay)\n";
  if (todos.length === 0) return head + "\nKhông có việc treo.\n";
  const rows = todos
    .sort((a, b) => a.file.localeCompare(b.file) || a.title.localeCompare(b.title))
    .map(t => `- ${t.title} (${t.file})`)
    .join("\n");
  return head + "\n" + rows + "\n";
}

type VitestJson = {
  testResults: { name: string; assertionResults: { title: string; status: string }[] }[];
};

function generate(): void {
  const root = process.cwd();
  const tmp = join(tmpdir(), `vitest-todos-${process.pid}.json`);

  // vitest exits 0 when only .todo tests are present. A real failure exits
  // non-zero and throws here, which is correct: do not regenerate the open-items
  // list from a broken test run. A command string (not an args array) is used so
  // the shell resolves `npx` on Windows without triggering DEP0190.
  execSync(
    `npx vitest run --reporter=json --outputFile="${tmp}"`,
    { cwd: root, stdio: "inherit" },
  );

  const report = JSON.parse(readFileSync(tmp, "utf8")) as VitestJson;

  const todos: { title: string; file: string }[] = [];
  for (const testResult of report.testResults) {
    // testResult.name is an ABSOLUTE path in vitest 4.1.10; convert to a
    // repo-relative POSIX path so OPEN-ITEMS.md never leaks a machine path.
    const file = relative(root, testResult.name).split(sep).join("/");
    for (const assertion of testResult.assertionResults) {
      if (assertion.status === "todo") todos.push({ title: assertion.title, file });
    }
  }

  const outDir = join(root, "docs/04-operations");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "OPEN-ITEMS.md"), renderOpenItems(todos));
  rmSync(tmp, { force: true });

  console.log(`[open-items] ${todos.length} todo(s) -> docs/04-operations/OPEN-ITEMS.md`);
}

// Run only when invoked as a script, not when imported by the test. vite-node
// strips the script name from process.argv, so a require-main check is not
// available; instead skip generation inside vitest, which sets process.env.VITEST.
if (!process.env.VITEST) generate();
