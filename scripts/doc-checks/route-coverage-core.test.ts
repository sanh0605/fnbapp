import { describe, it, expect } from "vitest";
import { checkRouteCoverage } from "./route-coverage-core";

describe("checkRouteCoverage", () => {
  const covered = new Set(["/admin/inventory/items"]);
  const noRedirect = () => false;
  it("passes a route declared in a flow doc", () => {
    expect(checkRouteCoverage(["/admin/inventory/items"], covered, noRedirect).ok).toBe(true);
  });
  it("flags a real screen with no flow doc", () => {
    const r = checkRouteCoverage(["/admin/reports/new"], covered, noRedirect);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toContain("/admin/reports/new");
  });
  it("exempts a redirect-only page automatically", () => {
    expect(checkRouteCoverage(["/"], covered, route => route === "/").ok).toBe(true);
  });
});
