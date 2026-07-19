import fs from "node:fs";
import path from "node:path";
import {
  auditActionExports,
  auditRouteHandlers,
  isServerActionSourceFile,
  type GuardKind,
} from "../lib/admin-auth-guard-audit";
import {
  classifyActionStatus,
  classifyRouteStatus,
  getActionIntendedAccess,
  getRoutePolicy,
  type ActionStatus,
  type IntendedAccess,
  type RouteStatus,
} from "./audit-admin-action-auth-core";

type ActionRow = {
  file: string;
  action: string;
  kind: "MUTATION" | "READ";
  intendedAccess: IntendedAccess;
  guardKind: GuardKind;
  guardEnforced: boolean;
  anonymousRejected: boolean;
  wrongRoleRejected: boolean | null;
  status: ActionStatus;
  mutationSignals: string[];
};

type RouteRow = {
  file: string;
  method: string;
  intendedAccess: IntendedAccess;
  guardKind: GuardKind;
  guardEnforced: boolean;
  anonymousRejected: boolean | null;
  wrongRoleRejected: boolean | null;
  status: RouteStatus;
};

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

function findTypeScriptFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTypeScriptFiles(fullPath));
    } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

function auditActions(files: string[], cwd: string): ActionRow[] {
  const rows: ActionRow[] = [];
  for (const file of files) {
    const relativeFile = normalizePath(path.relative(cwd, file));
    const intendedAccess = getActionIntendedAccess(relativeFile);
    const source = fs.readFileSync(file, "utf8");
    for (const action of auditActionExports(source)) {
      const status = classifyActionStatus(
        intendedAccess,
        action.isMutation,
        action.guardKind,
        action.guardEnforced,
      );
      rows.push({
        file: relativeFile,
        action: action.name,
        kind: action.isMutation ? "MUTATION" : "READ",
        intendedAccess,
        guardKind: action.guardKind,
        guardEnforced: action.guardEnforced,
        anonymousRejected: action.guardEnforced,
        wrongRoleRejected: intendedAccess === "ADMIN"
          ? action.guardEnforced && action.guardKind === "ADMIN"
          : null,
        status,
        mutationSignals: action.mutationSignals,
      });
    }
  }
  return rows;
}

function auditRoutes(files: string[], cwd: string): RouteRow[] {
  const rows: RouteRow[] = [];
  for (const file of files) {
    const relativeFile = normalizePath(path.relative(cwd, file));
    const intendedAccess = getRoutePolicy(relativeFile);
    const source = fs.readFileSync(file, "utf8");
    for (const handler of auditRouteHandlers(source)) {
      const status: RouteStatus = classifyRouteStatus(
        intendedAccess,
        handler.guardKind,
        handler.guardEnforced,
      );

      rows.push({
        file: relativeFile,
        method: handler.method,
        intendedAccess,
        guardKind: handler.guardKind,
        guardEnforced: handler.guardEnforced,
        anonymousRejected: intendedAccess.startsWith("PUBLIC") ? null : handler.guardEnforced,
        wrongRoleRejected: intendedAccess === "ADMIN"
          ? handler.guardEnforced && handler.guardKind === "ADMIN"
          : null,
        status,
      });
    }
  }
  return rows;
}

const cwd = process.cwd();
const appRoot = path.resolve(cwd, "app");
const allTypeScriptFiles = findTypeScriptFiles(appRoot);
const actionFiles = allTypeScriptFiles.filter((file) => {
  const source = fs.readFileSync(file, "utf8");
  return isServerActionSourceFile(normalizePath(path.relative(cwd, file)), source);
});
const routeFiles = allTypeScriptFiles.filter((file) => (
  normalizePath(path.relative(cwd, file)).startsWith("app/api/")
  && path.basename(file) === "route.ts"
));
const actions = auditActions(actionFiles, cwd);
const routes = auditRoutes(routeFiles, cwd);
const conventionalActionFiles = actionFiles.filter((file) => path.basename(file) === "actions.ts");
const directiveOnlyActionFiles = actionFiles.filter((file) => path.basename(file) !== "actions.ts");
const mutationFindings = actions.filter((row) => (
  row.kind === "MUTATION" && row.status !== "GUARDED"
));
const readFindings = actions.filter((row) => row.kind === "READ" && row.status !== "GUARDED");
const routeFindings = routes.filter((row) => row.status === "UNGUARDED_ROUTE");

const result = {
  generatedAt: new Date().toISOString(),
  readOnly: true,
  summary: {
    actionFiles: actionFiles.length,
    conventionalActionFiles: conventionalActionFiles.length,
    directiveOnlyActionFiles: directiveOnlyActionFiles.length,
    actionExports: actions.length,
    mutationActions: actions.filter((row) => row.kind === "MUTATION").length,
    readActions: actions.filter((row) => row.kind === "READ").length,
    mutationFindings: mutationFindings.length,
    readFindings: readFindings.length,
    routeFiles: routeFiles.length,
    routeHandlers: routes.length,
    routeFindings: routeFindings.length,
  },
  actionFiles: actionFiles.map((file) => normalizePath(path.relative(cwd, file))),
  directiveOnlyActionFiles: directiveOnlyActionFiles.map((file) => normalizePath(path.relative(cwd, file))),
  routeFiles: routeFiles.map((file) => normalizePath(path.relative(cwd, file))),
  actions,
  routes,
};

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log("=== APPLICATION ACCESS AUDIT (READ ONLY) ===");
  console.log(
    `Server-action files: ${result.summary.actionFiles} `
      + `(${result.summary.conventionalActionFiles} actions.ts + `
      + `${result.summary.directiveOnlyActionFiles} explicit use-server file)`,
  );
  console.log(`Action exports: ${result.summary.actionExports}`);
  console.log(`Mutation findings: ${result.summary.mutationFindings}`);
  console.log(`Read/direct-invocation findings: ${result.summary.readFindings}`);
  console.log(`API route files/handlers: ${result.summary.routeFiles}/${result.summary.routeHandlers}`);
  console.log(`Unguarded API route findings: ${result.summary.routeFindings}`);

  console.log("\nActions:");
  for (const row of actions) {
    console.log(
      `${row.file} :: ${row.action} [${row.kind}] `
        + `access=${row.intendedAccess} guard=${row.guardKind}/${row.guardEnforced ? "ENFORCED" : "NOT_ENFORCED"} `
        + `status=${row.status}`,
    );
  }

  console.log("\nAPI routes:");
  for (const row of routes) {
    console.log(
      `${row.file} :: ${row.method} access=${row.intendedAccess} `
        + `guard=${row.guardKind}/${row.guardEnforced ? "ENFORCED" : "NOT_ENFORCED"} `
        + `status=${row.status}`,
    );
  }
  console.log("\nNo data was written.");
}

if (mutationFindings.length > 0 || readFindings.length > 0 || routeFindings.length > 0) {
  process.exitCode = 1;
}
