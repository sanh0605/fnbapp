/**
 * Gate 3 Phase A live database/RPC/RLS audit.
 *
 * This script uses Supabase's Management API read-only SQL endpoint, which
 * executes as supabase_read_only_user. It never sends SQL to a writable
 * endpoint and has no apply mode.
 *
 * Usage:
 *   vite-node scripts/audit-gate3-database-security.ts
 *   vite-node scripts/audit-gate3-database-security.ts --output=docs/audits/2026-07-19-gate3-database-rls-audit.json
 */

import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as dotenv from "dotenv";
import { BACKUP_TABLES } from "../supabase/functions/backup-to-drive/core";
import {
  assessRawSqlExposure,
  buildReadOnlyManagementUrl,
  compareTableScope,
  detectCallerCheckSignals,
  normalizeManagementRows,
  type FunctionSecurityRow,
} from "./audit-gate3-database-security-core";

dotenv.config({ path: ".env.local", quiet: true });

type TableSecurityRow = {
  tableName: string;
  rlsEnabled: boolean;
  rlsForced: boolean;
};

type PolicyRow = {
  tableName: string;
  policyName: string;
  permissive: string;
  roles: string[];
  command: string;
  usingExpression: string | null;
  checkExpression: string | null;
};

type TablePrivilegeRow = {
  roleName: "anon" | "authenticated";
  tableName: string;
  select: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
  truncate: boolean;
  references: boolean;
  trigger: boolean;
};

type FunctionAuditRow = Omit<FunctionSecurityRow, "definition"> & {
  signature: string;
  definitionSha256: string;
  callerCheckSignals: string[];
  repositoryRpc: boolean;
};

const REPOSITORY_RPC_NAMES = [
  "apply_backdated_event_recovery",
  "apply_hong_to_luc_migration",
  "apply_mac_drift_recovery",
  "apply_purchase_cost_recovery",
  "create_pos_order_atomic",
  "exec_sql",
  "get_pos_inventory_state",
  "get_table_constraints",
  "mark_backdated_event_recomputed",
  "reject_backdated_event",
  "rollback_purchase_cost_recovery",
  "save_purchase_order_atomic",
] as const;

const TABLES_SQL = `
select
  c.relname as "tableName",
  c.relrowsecurity as "rlsEnabled",
  c.relforcerowsecurity as "rlsForced"
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by c.relname
`;

const POLICIES_SQL = `
select
  tablename as "tableName",
  policyname as "policyName",
  permissive,
  roles,
  cmd as "command",
  qual as "usingExpression",
  with_check as "checkExpression"
from pg_catalog.pg_policies
where schemaname = 'public'
order by tablename, policyname
`;

const TABLE_PRIVILEGES_SQL = `
with audited_roles("roleName") as (
  values ('anon'::name), ('authenticated'::name)
)
select
  audited_roles."roleName",
  c.relname as "tableName",
  pg_catalog.has_table_privilege(audited_roles."roleName", c.oid, 'SELECT') as "select",
  pg_catalog.has_table_privilege(audited_roles."roleName", c.oid, 'INSERT') as "insert",
  pg_catalog.has_table_privilege(audited_roles."roleName", c.oid, 'UPDATE') as "update",
  pg_catalog.has_table_privilege(audited_roles."roleName", c.oid, 'DELETE') as "delete",
  pg_catalog.has_table_privilege(audited_roles."roleName", c.oid, 'TRUNCATE') as "truncate",
  pg_catalog.has_table_privilege(audited_roles."roleName", c.oid, 'REFERENCES') as "references",
  pg_catalog.has_table_privilege(audited_roles."roleName", c.oid, 'TRIGGER') as "trigger"
from audited_roles
cross join pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
order by audited_roles."roleName", c.relname
`;

const FUNCTIONS_SQL = `
select
  p.proname as "name",
  pg_catalog.pg_get_function_identity_arguments(p.oid) as "identityArguments",
  pg_catalog.pg_get_function_result(p.oid) as "resultType",
  owner.rolname as "owner",
  p.prosecdef as "securityDefiner",
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as "anonCanExecute",
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as "authenticatedCanExecute",
  pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') as "serviceRoleCanExecute",
  pg_catalog.pg_get_functiondef(p.oid) as "definition"
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
join pg_catalog.pg_roles owner on owner.oid = p.proowner
where n.nspname = 'public'
  and p.prokind in ('f', 'p')
order by p.proname, pg_catalog.pg_get_function_identity_arguments(p.oid)
`;

async function runReadOnlyQuery<T>(
  endpoint: string,
  accessToken: string,
  query: string,
): Promise<T[]> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, parameters: [] }),
  });
  const payload: unknown = await response.json().catch(async () => ({
    error: await response.text(),
  }));
  if (!response.ok) {
    throw new Error(
      `Supabase read-only query failed (${response.status}): ${JSON.stringify(payload)}`,
    );
  }
  return normalizeManagementRows<T>(payload);
}

function hasAnyTablePrivilege(row: TablePrivilegeRow): boolean {
  return row.select || row.insert || row.update || row.delete || row.truncate ||
    row.references || row.trigger;
}

async function main(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  if (!supabaseUrl || !accessToken) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_ACCESS_TOKEN are required in .env.local",
    );
  }

  const endpoint = buildReadOnlyManagementUrl(supabaseUrl);
  const [tables, policies, tablePrivileges, functionRows] = await Promise.all([
    runReadOnlyQuery<TableSecurityRow>(endpoint, accessToken, TABLES_SQL),
    runReadOnlyQuery<PolicyRow>(endpoint, accessToken, POLICIES_SQL),
    runReadOnlyQuery<TablePrivilegeRow>(
      endpoint,
      accessToken,
      TABLE_PRIVILEGES_SQL,
    ),
    runReadOnlyQuery<FunctionSecurityRow>(endpoint, accessToken, FUNCTIONS_SQL),
  ]);

  const rawSqlExposure = assessRawSqlExposure(functionRows);
  const tableScope = compareTableScope(
    tables.map(row => row.tableName),
    BACKUP_TABLES,
  );
  const repositoryRpcNames = new Set<string>(REPOSITORY_RPC_NAMES);
  const functions: FunctionAuditRow[] = functionRows.map(row => ({
    name: row.name,
    identityArguments: row.identityArguments,
    resultType: row.resultType,
    owner: row.owner,
    securityDefiner: row.securityDefiner,
    anonCanExecute: row.anonCanExecute,
    authenticatedCanExecute: row.authenticatedCanExecute,
    serviceRoleCanExecute: row.serviceRoleCanExecute,
    signature: `${row.name}(${row.identityArguments})`,
    definitionSha256: createHash("sha256").update(row.definition).digest("hex"),
    callerCheckSignals: detectCallerCheckSignals(row.definition),
    repositoryRpc: repositoryRpcNames.has(row.name),
  }));
  const liveFunctionNames = new Set(functionRows.map(row => row.name));
  const repositoryRpcs = REPOSITORY_RPC_NAMES.map(name => ({
    name,
    live: liveFunctionNames.has(name),
    overloads: functions.filter(row => row.name === name),
  }));
  const exposedTablePrivileges = tablePrivileges.filter(hasAnyTablePrivilege);

  const artifact = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    executionBoundary: {
      endpoint: "Supabase Management API /database/query/read-only",
      databaseRole: "supabase_read_only_user",
      databaseWritesAttempted: 0,
    },
    summary: {
      publicTables: tables.length,
      rlsEnabled: tables.filter(row => row.rlsEnabled).length,
      rlsForced: tables.filter(row => row.rlsForced).length,
      rlsPolicies: policies.length,
      anonTablesWithAnyPrivilege: new Set(
        exposedTablePrivileges
          .filter(row => row.roleName === "anon")
          .map(row => row.tableName),
      ).size,
      authenticatedTablesWithAnyPrivilege: new Set(
        exposedTablePrivileges
          .filter(row => row.roleName === "authenticated")
          .map(row => row.tableName),
      ).size,
      publicFunctions: functions.length,
      anonExecutableFunctions: functions.filter(row => row.anonCanExecute).length,
      authenticatedExecutableFunctions: functions.filter(
        row => row.authenticatedCanExecute,
      ).length,
      repositoryRpcsMissingLive: repositoryRpcs
        .filter(row => !row.live)
        .map(row => row.name),
      rawSqlStopGate: rawSqlExposure.stopGate,
    },
    tableScope,
    rawSqlExposure,
    tables,
    policies,
    tablePrivileges,
    functions,
    repositoryRpcs,
  };

  const outputArg = process.argv.find(arg => arg.startsWith("--output="));
  if (outputArg) {
    const outputPath = resolve(process.cwd(), outputArg.slice("--output=".length));
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    console.error(`Wrote ${outputPath}`);
  }
  console.log(JSON.stringify(artifact, null, 2));

  if (rawSqlExposure.stopGate) {
    console.error(
      "STOP GATE: a raw-SQL RPC is executable by anon or authenticated.",
    );
    process.exitCode = 2;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
