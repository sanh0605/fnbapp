import ts from "typescript";

export type GuardKind = "ADMIN" | "ACTOR" | "SESSION" | "NONE";

export type ActionExportAudit = {
  name: string;
  exportStyle: "function" | "arrow" | "wrapped-arrow";
  isMutation: boolean;
  mutationSignals: string[];
  guardKind: GuardKind;
  guardEnforced: boolean;
};

export type RouteHandlerAudit = {
  method: string;
  exportStyle: "function" | "arrow" | "alias";
  mutationSignals: string[];
  guardKind: GuardKind;
  guardEnforced: boolean;
};

const HTTP_METHODS = new Set(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]);

export function isServerActionSourceFile(filePath: string, source: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, "/");
  if (normalizedPath.endsWith("/actions.ts")) return true;
  if (!normalizedPath.endsWith(".ts")) return false;

  const sourceFile = ts.createSourceFile(
    normalizedPath,
    source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  return sourceFile.statements.some((statement) => (
    ts.isExpressionStatement(statement)
    && ts.isStringLiteral(statement.expression)
    && statement.expression.text === "use server"
  ));
}

const DIRECT_MUTATION_CALLS = new Set([
  "createEntity",
  "deleteEntity",
  "insert",
  "insertMany",
  "remove",
  "removeMany",
  "update",
  "updateMany",
  "savePosOrderAtomic",
  "savePurchaseOrderAtomic",
  "softDeleteEntity",
  "supersedeOrderV2",
  "updateEntity",
  "recomputeEventApply",
]);

const PROPERTY_MUTATION_CALLS = new Set([
  "delete",
  "insert",
  "remove",
  "rpc",
  "update",
  "upsert",
]);

type ExportedFunction = {
  name: string;
  exportStyle: ActionExportAudit["exportStyle"];
  body: ts.Block;
};

type GuardBinding = {
  variableName: string;
  kind: Exclude<GuardKind, "NONE">;
};

function hasExportModifier(node: ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> }): boolean {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function extractExportedFunctions(sourceFile: ts.SourceFile): ExportedFunction[] {
  const functions: ExportedFunction[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement)
      && statement.name
      && statement.body
      && hasExportModifier(statement)
    ) {
      functions.push({
        name: statement.name.text,
        exportStyle: "function",
        body: statement.body,
      });
      continue;
    }

    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const initializer = declaration.initializer;
      const directArrow = ts.isArrowFunction(initializer) ? initializer : null;
      const wrappedArrow = ts.isCallExpression(initializer)
        && initializer.arguments[0]
        && ts.isArrowFunction(initializer.arguments[0])
        ? initializer.arguments[0]
        : null;
      const arrow = directArrow ?? wrappedArrow;
      if (!arrow || !ts.isBlock(arrow.body)) continue;
      functions.push({
        name: declaration.name.text,
        exportStyle: directArrow ? "arrow" : "wrapped-arrow",
        body: arrow.body,
      });
    }
  }

  return functions;
}

function unwrapCallExpression(expression: ts.Expression): ts.CallExpression | null {
  let current = expression;
  while (ts.isAwaitExpression(current) || ts.isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return ts.isCallExpression(current) ? current : null;
}

function getGuardCallKind(call: ts.CallExpression): Exclude<GuardKind, "NONE"> | null {
  if (!ts.isIdentifier(call.expression)) return null;
  if (call.expression.text === "requireAdmin") return "ADMIN";
  if (call.expression.text === "resolveActor") return "ACTOR";
  if (call.expression.text === "getServerSession") return "SESSION";
  return null;
}

function collectGuardBindings(body: ts.Block): GuardBinding[] {
  const bindings: GuardBinding[] = [];

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const call = unwrapCallExpression(node.initializer);
      const kind = call ? getGuardCallKind(call) : null;
      if (kind) bindings.push({ variableName: node.name.text, kind });
    }
    ts.forEachChild(node, visit);
  }

  visit(body);
  return bindings;
}

function statementExits(statement: ts.Statement): boolean {
  if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) return true;
  if (ts.isBlock(statement)) return statement.statements.some(statementExits);
  return false;
}

function conditionRejectsGuardFailure(
  condition: ts.Expression,
  binding: GuardBinding,
  sourceFile: ts.SourceFile,
): boolean {
  const text = condition.getText(sourceFile).replace(/\s+/g, "");
  const variable = binding.variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (binding.kind === "SESSION") {
    return new RegExp(`!${variable}(?:\\b|\\.)`).test(text);
  }
  return new RegExp(
    `!${variable}\\.ok\\b|${variable}\\.ok(?:===false|!==true)`,
  ).test(text);
}

function isGuardEnforced(
  body: ts.Block,
  binding: GuardBinding,
  sourceFile: ts.SourceFile,
): boolean {
  let enforced = false;

  function visit(node: ts.Node): void {
    if (enforced) return;
    if (
      ts.isIfStatement(node)
      && conditionRejectsGuardFailure(node.expression, binding, sourceFile)
      && statementExits(node.thenStatement)
    ) {
      enforced = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(body);
  return enforced;
}

function isAdminRoleEnforced(
  body: ts.Block,
  binding: GuardBinding,
  sourceFile: ts.SourceFile,
): boolean {
  if (binding.kind !== "ACTOR") return false;
  let enforced = false;

  function visit(node: ts.Node): void {
    if (enforced) return;
    if (ts.isIfStatement(node) && statementExits(node.thenStatement)) {
      const text = node.expression.getText(sourceFile).replace(/\s+/g, "");
      const variable = binding.variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rejectsNonAdmin = new RegExp(
        `${variable}\\.actor\\.role(?:!==|!=)["']ADMIN["']`,
      ).test(text);
      if (rejectsNonAdmin && conditionRejectsGuardFailure(node.expression, binding, sourceFile)) {
        enforced = true;
        return;
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(body);
  return enforced;
}

function isPostFetch(call: ts.CallExpression): boolean {
  if (!ts.isIdentifier(call.expression) || call.expression.text !== "fetch") return false;
  const options = call.arguments[1];
  if (!options || !ts.isObjectLiteralExpression(options)) return false;
  return options.properties.some((property) => {
    if (!ts.isPropertyAssignment(property)) return false;
    const name = property.name.getText().replace(/["']/g, "");
    return name === "method"
      && ts.isStringLiteralLike(property.initializer)
      && property.initializer.text.toUpperCase() === "POST";
  });
}

function collectMutationSignals(body: ts.Block): string[] {
  const signals = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      if (ts.isIdentifier(node.expression) && DIRECT_MUTATION_CALLS.has(node.expression.text)) {
        signals.add(node.expression.text);
      } else if (
        ts.isPropertyAccessExpression(node.expression)
        && PROPERTY_MUTATION_CALLS.has(node.expression.name.text)
      ) {
        signals.add(node.expression.name.text);
      } else if (isPostFetch(node)) {
        signals.add("fetch:POST");
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(body);
  return [...signals].sort();
}

export function auditActionExports(source: string): ActionExportAudit[] {
  const sourceFile = ts.createSourceFile(
    "actions.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  return extractExportedFunctions(sourceFile).map((exportedFunction) => {
    const bindings = collectGuardBindings(exportedFunction.body);
    const enforcedBinding = bindings.find((binding) => (
      isGuardEnforced(exportedFunction.body, binding, sourceFile)
    ));
    const mutationSignals = collectMutationSignals(exportedFunction.body);

    return {
      name: exportedFunction.name,
      exportStyle: exportedFunction.exportStyle,
      isMutation: mutationSignals.length > 0,
      mutationSignals,
      guardKind: enforcedBinding && isAdminRoleEnforced(
        exportedFunction.body,
        enforcedBinding,
        sourceFile,
      )
        ? "ADMIN"
        : enforcedBinding?.kind ?? bindings[0]?.kind ?? "NONE",
      guardEnforced: Boolean(enforcedBinding),
    };
  });
}

export function findUnguardedAdminMutations(source: string): string[] {
  return auditActionExports(source)
    .filter((entry) => entry.isMutation && !entry.guardEnforced)
    .map((entry) => entry.name);
}

export function auditRouteHandlers(source: string): RouteHandlerAudit[] {
  const sourceFile = ts.createSourceFile(
    "route.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const actionAudits = new Map(auditActionExports(source).map((entry) => [entry.name, entry]));
  const handlers: RouteHandlerAudit[] = [];

  for (const statement of sourceFile.statements) {
    if (
      ts.isFunctionDeclaration(statement)
      && statement.name
      && HTTP_METHODS.has(statement.name.text)
      && hasExportModifier(statement)
    ) {
      const audit = actionAudits.get(statement.name.text);
      handlers.push({
        method: statement.name.text,
        exportStyle: "function",
        mutationSignals: audit?.mutationSignals ?? [],
        guardKind: audit?.guardKind ?? "NONE",
        guardEnforced: audit?.guardEnforced ?? false,
      });
      continue;
    }

    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !HTTP_METHODS.has(declaration.name.text)) continue;
        const audit = actionAudits.get(declaration.name.text);
        handlers.push({
          method: declaration.name.text,
          exportStyle: "arrow",
          mutationSignals: audit?.mutationSignals ?? [],
          guardKind: audit?.guardKind ?? "NONE",
          guardEnforced: audit?.guardEnforced ?? false,
        });
      }
      continue;
    }

    if (
      ts.isExportDeclaration(statement)
      && statement.exportClause
      && ts.isNamedExports(statement.exportClause)
    ) {
      for (const element of statement.exportClause.elements) {
        const exportedName = element.name.text;
        if (!HTTP_METHODS.has(exportedName)) continue;
        handlers.push({
          method: exportedName,
          exportStyle: "alias",
          mutationSignals: [],
          guardKind: "NONE",
          guardEnforced: false,
        });
      }
    }
  }

  return handlers;
}
