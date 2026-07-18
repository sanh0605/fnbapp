import { describe, expect, it } from "vitest";
import {
  assessRawSqlExposure,
  buildReadOnlyManagementUrl,
  compareTableScope,
  detectCallerCheckSignals,
  normalizeManagementRows,
  type FunctionSecurityRow,
} from "./audit-gate3-database-security-core";

describe("Gate 3 database security audit core", () => {
  it("normalizes single-row and multi-row Management API responses", () => {
    expect(normalizeManagementRows<{ value: number }>({ value: 1 })).toEqual([
      { value: 1 },
    ]);
    expect(
      normalizeManagementRows<{ value: number }>([{ value: 1 }, { value: 2 }]),
    ).toEqual([{ value: 1 }, { value: 2 }]);
    expect(normalizeManagementRows(null)).toEqual([]);
  });

  it("uses the Management API endpoint that enforces a read-only database role", () => {
    expect(
      buildReadOnlyManagementUrl(
        "https://abc123.supabase.co",
      ),
    ).toBe(
      "https://api.supabase.com/v1/projects/abc123/database/query/read-only",
    );
    expect(() => buildReadOnlyManagementUrl("not-a-project-url")).toThrow(
      "Cannot derive Supabase project ref",
    );
  });

  it("detects explicit caller checks without treating SECURITY DEFINER as a check", () => {
    const definition = `
      create function public.example() returns void
      language plpgsql security definer
      as $$
      begin
        if auth.uid() is null or current_user <> 'service_role' then
          raise exception 'forbidden';
        end if;
      end;
      $$;
    `;

    expect(detectCallerCheckSignals(definition)).toEqual([
      "auth.uid()",
      "current_user",
    ]);
    expect(
      detectCallerCheckSignals(
        "create function public.no_check() returns void security definer language sql as $$ select $$;",
      ),
    ).toEqual([]);
  });

  it("reconciles live public tables against the frozen backup allowlist", () => {
    expect(
      compareTableScope(
        ["orders_v2", "order_lines_v2", "untracked_live"],
        ["orders_v2", "order_lines_v2", "missing_live"],
      ),
    ).toEqual({
      liveNotBackedUp: ["untracked_live"],
      backedUpNotLive: ["missing_live"],
    });
  });

  it("raises the stop gate when a raw-SQL RPC is executable by anon or authenticated", () => {
    const functions: FunctionSecurityRow[] = [
      functionRow({
        name: "exec_sql",
        anonCanExecute: true,
        authenticatedCanExecute: true,
      }),
      functionRow({
        name: "save_purchase_order_atomic",
        anonCanExecute: false,
        authenticatedCanExecute: false,
      }),
    ];

    expect(assessRawSqlExposure(functions)).toEqual({
      candidates: ["exec_sql()"],
      exposedToAnon: ["exec_sql()"],
      exposedToAuthenticated: ["exec_sql()"],
      stopGate: true,
    });
  });

  it("does not invent an exec_sql finding when no raw-SQL function exists", () => {
    expect(
      assessRawSqlExposure([
        functionRow({ name: "get_table_constraints" }),
      ]),
    ).toEqual({
      candidates: [],
      exposedToAnon: [],
      exposedToAuthenticated: [],
      stopGate: false,
    });
  });

  it("detects a renamed raw-SQL RPC from its text query argument and dynamic execution", () => {
    const disguised = functionRow({
      name: "maintenance_helper",
      identityArguments: "p_query text",
      definition: "begin execute p_query; end",
      authenticatedCanExecute: true,
    });

    expect(assessRawSqlExposure([disguised])).toEqual({
      candidates: ["maintenance_helper(p_query text)"],
      exposedToAnon: [],
      exposedToAuthenticated: ["maintenance_helper(p_query text)"],
      stopGate: true,
    });
  });
});

function functionRow(
  overrides: Partial<FunctionSecurityRow>,
): FunctionSecurityRow {
  return {
    name: "example",
    identityArguments: "",
    resultType: "void",
    owner: "postgres",
    securityDefiner: false,
    anonCanExecute: false,
    authenticatedCanExecute: false,
    serviceRoleCanExecute: true,
    definition: "",
    ...overrides,
  };
}
