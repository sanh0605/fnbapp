import { describe, it, expect } from "vitest";
import { rpcCallSites, rpcWriteTargets, resolveRpcWrites } from "./extract-rpc";

describe("extract-rpc", () => {
  it("finds .rpc call sites", () => {
    const files = [{ path: "lib/manual-issue-transaction.ts", source: `await client.rpc("create_issue_slip_atomic", { p });` }];
    expect(rpcCallSites(files)).toEqual([{ file: "lib/manual-issue-transaction.ts", fn: "create_issue_slip_atomic" }]);
  });

  it("reads write targets from the latest function definition", () => {
    const older = `create function create_issue_slip_atomic() returns void as $$ begin
      insert into public.stock_ledger (id) values ('x'); end; $$ language plpgsql;`;
    const newer = `create or replace function create_issue_slip_atomic() returns void as $$ begin
      insert into public.issue_slips (id) values ('x');
      insert into public.stock_issues (id) values ('y'); end; $$ language plpgsql;`;
    const targets = rpcWriteTargets([older, newer]);
    expect(targets.get("create_issue_slip_atomic")).toEqual(["issue_slips", "stock_issues"]);
  });

  it("reads a dollar-quote-tagged latest definition, not a stale $$ one", () => {
    const older = `create or replace function public.f() returns void as $$ begin
      insert into public.stock_ledger (id) values ('x'); end; $$ language plpgsql;`;
    const newer = `create or replace function public.f() returns void as $function$ begin
      insert into public.x (id) values ('x'); end; $function$ language plpgsql;`;
    const targets = rpcWriteTargets([older, newer]);
    expect(targets.get("f")).toEqual(["x"]);
  });

  it("resolves call site to tables, and flags an unknown function", () => {
    const callSites = [
      { file: "lib/x.ts", fn: "create_issue_slip_atomic" },
      { file: "lib/y.ts", fn: "mystery_fn" },
    ];
    const targets = new Map([["create_issue_slip_atomic", ["issue_slips", "stock_issues"]]]);
    const r = resolveRpcWrites(callSites, targets);
    expect(r.writes).toEqual([
      { file: "lib/x.ts", table: "issue_slips" },
      { file: "lib/x.ts", table: "stock_issues" },
    ]);
    expect(r.unresolved).toEqual([{ file: "lib/y.ts", reason: "rpc('mystery_fn') has no function body found in migrations" }]);
  });
});
