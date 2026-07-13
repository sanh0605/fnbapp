import {
  readFileSync,
  readdirSync,
} from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { isRecoveryRunId, verifySnapshotBundleFiles } from "../lib/recovery-snapshot";

function listFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

function main(): void {
  const runId = process.argv.slice(2).find(arg => !arg.startsWith("--"));
  if (!runId || !isRecoveryRunId(runId)) {
    throw new Error(
      "Usage: vite-node scripts/verify-recovery-snapshot.ts <recovery-run-id>",
    );
  }

  const bundleDirectory = resolve(
    process.cwd(),
    "recovery-snapshots",
    runId,
  );
  const files = Object.fromEntries(
    listFiles(bundleDirectory).map(filePath => [
      relative(bundleDirectory, filePath).split(sep).join("/"),
      readFileSync(filePath, "utf8"),
    ]),
  );
  const result = verifySnapshotBundleFiles(files);

  console.log("=== RECOVERY SNAPSHOT VERIFICATION (READ ONLY) ===");
  console.log(`Run: ${runId}`);
  console.log(`Files checked: ${result.checkedFiles}`);
  console.log(`Status: ${result.valid ? "VALID" : "INVALID"}`);
  for (const error of result.errors) {
    console.log(error);
  }
  console.log("No files or operational data were written.");
  if (!result.valid) {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
