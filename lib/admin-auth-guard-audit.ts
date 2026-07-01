import ts from "typescript";

const MUTATION_PREFIXES = [
  "add",
  "approve",
  "delete",
  "edit",
  "save",
  "submit",
  "toggle",
  "update",
];

export function findUnguardedAdminMutations(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    "actions.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations: string[] = [];

  for (const statement of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body) {
      continue;
    }
    const isExported = statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (!isExported) continue;

    const name = statement.name.text;
    const isMutation = MUTATION_PREFIXES.some((prefix) => name.startsWith(prefix));
    if (!isMutation) continue;

    const body = statement.body.getText(sourceFile);
    const hasGuard = /\b(requireAdmin|resolveActor)\s*\(/.test(body);
    if (!hasGuard) violations.push(name);
  }

  return violations;
}
