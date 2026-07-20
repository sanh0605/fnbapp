import { describe, expect, it } from "vitest";
import {
  classifyActionStatus,
  classifyRouteStatus,
  getActionIntendedAccess,
  getRoutePolicy,
} from "./audit-admin-action-auth-core";

describe("admin action/route auth audit core", () => {
  it("classifies action files under app/admin/ as ADMIN, everything else as AUTHENTICATED", () => {
    expect(getActionIntendedAccess("app/admin/orders/actions.ts")).toBe("ADMIN");
    expect(getActionIntendedAccess("app/pos/actions.ts")).toBe("AUTHENTICATED");
    expect(getActionIntendedAccess("app/api/client-errors/route.ts")).toBe("AUTHENTICATED");
  });

  it("flags an ADMIN action guarded only by a non-ADMIN check as WRONG_ROLE_GAP", () => {
    expect(classifyActionStatus("ADMIN", true, "ACTOR", true)).toBe("WRONG_ROLE_GAP");
    expect(classifyActionStatus("ADMIN", true, "ADMIN", true)).toBe("GUARDED");
  });

  it("accepts any enforced guard for AUTHENTICATED-intended actions", () => {
    expect(classifyActionStatus("AUTHENTICATED", true, "ACTOR", true)).toBe("GUARDED");
    expect(classifyActionStatus("AUTHENTICATED", false, "SESSION", true)).toBe("GUARDED");
  });

  it("flags any unenforced guard as unguarded regardless of intended access", () => {
    expect(classifyActionStatus("ADMIN", true, "NONE", false)).toBe("UNGUARDED_MUTATION");
    expect(classifyActionStatus("AUTHENTICATED", false, "NONE", false)).toBe("UNGUARDED_READ");
  });

  it("keeps the existing route policy exception unchanged", () => {
    expect(getRoutePolicy("app/api/auth/[...nextauth]/route.ts")).toBe("PUBLIC_AUTH");
  });

  it("classifies /api/client-errors as AUTHENTICATED, not ADMIN", () => {
    expect(getRoutePolicy("app/api/client-errors/route.ts")).toBe("AUTHENTICATED");
  });

  it("defaults every other route to ADMIN (no policy regression)", () => {
    expect(getRoutePolicy("app/api/revalidate/route.ts")).toBe("ADMIN");
  });

  it("classifies an AUTHENTICATED route guarded by ACTOR as GUARDED (the Gate 8 fix)", () => {
    expect(classifyRouteStatus("AUTHENTICATED", "ACTOR", true)).toBe("GUARDED");
    expect(classifyRouteStatus("AUTHENTICATED", "SESSION", true)).toBe("GUARDED");
  });

  it("still flags an AUTHENTICATED route with no enforced guard as UNGUARDED_ROUTE", () => {
    expect(classifyRouteStatus("AUTHENTICATED", "NONE", false)).toBe("UNGUARDED_ROUTE");
  });

  it("does not weaken ADMIN routes: ACTOR/SESSION guard is still not enough", () => {
    expect(classifyRouteStatus("ADMIN", "ACTOR", true)).toBe("UNGUARDED_ROUTE");
    expect(classifyRouteStatus("ADMIN", "SESSION", true)).toBe("UNGUARDED_ROUTE");
    expect(classifyRouteStatus("ADMIN", "ADMIN", true)).toBe("GUARDED");
  });

  it("keeps the PUBLIC_AUTH/PUBLIC_RETIRED route classifications unchanged", () => {
    expect(classifyRouteStatus("PUBLIC_AUTH", "NONE", false)).toBe("INTENTIONAL_PUBLIC");
    expect(classifyRouteStatus("PUBLIC_RETIRED", "NONE", false)).toBe("RETIRED");
  });
});
