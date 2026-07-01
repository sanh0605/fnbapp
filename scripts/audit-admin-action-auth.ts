import fs from "node:fs";
import path from "node:path";
import { findUnguardedAdminMutations } from "../lib/admin-auth-guard-audit";

function findActionFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findActionFiles(fullPath));
    } else if (entry.name === "actions.ts") {
      files.push(fullPath);
    }
  }
  return files;
}

const root = path.resolve(process.cwd(), "app", "admin");
const violations: Array<{ file: string; functions: string[] }> = [];

for (const file of findActionFiles(root)) {
  const source = fs.readFileSync(file, "utf8");
  const functions = findUnguardedAdminMutations(source);
  if (functions.length > 0) {
    violations.push({
      file: path.relative(process.cwd(), file),
      functions,
    });
  }
}

console.log("=== ADMIN ACTION AUTH AUDIT (READ ONLY) ===");
console.log(`Files checked: ${findActionFiles(root).length}`);
console.log(`Files with violations: ${violations.length}`);
for (const violation of violations) {
  console.log(`${violation.file}: ${violation.functions.join(", ")}`);
}
console.log("\nNo data was written.");

if (violations.length > 0) {
  process.exitCode = 1;
}
