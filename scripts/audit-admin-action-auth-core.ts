import type { GuardKind } from "../lib/admin-auth-guard-audit";

export type IntendedAccess = "ADMIN" | "AUTHENTICATED" | "PUBLIC_AUTH" | "PUBLIC_RETIRED";
export type ActionStatus = "GUARDED" | "UNGUARDED_MUTATION" | "UNGUARDED_READ" | "WRONG_ROLE_GAP";
export type RouteStatus = "GUARDED" | "INTENTIONAL_PUBLIC" | "RETIRED" | "UNGUARDED_ROUTE";

export function getActionIntendedAccess(relativeFile: string): IntendedAccess {
  return relativeFile.startsWith("app/admin/") ? "ADMIN" : "AUTHENTICATED";
}

export function classifyActionStatus(
  intendedAccess: IntendedAccess,
  isMutation: boolean,
  guardKind: GuardKind,
  guardEnforced: boolean,
): ActionStatus {
  if (!guardEnforced) return isMutation ? "UNGUARDED_MUTATION" : "UNGUARDED_READ";
  if (intendedAccess === "ADMIN" && guardKind !== "ADMIN") return "WRONG_ROLE_GAP";
  return "GUARDED";
}

// Routes outside app/admin/ default to ADMIN too (the historical, conservative
// default for this audit), except for the explicit policy exceptions below.
// "AUTHENTICATED" means any signed-in actor is the intended audience (e.g. a
// route POS/staff sessions call directly, not just admins) -- guardKind ACTOR
// or SESSION satisfies that policy just as well as ADMIN does.
export function getRoutePolicy(relativeFile: string): IntendedAccess {
  if (relativeFile === "app/api/auth/[...nextauth]/route.ts") return "PUBLIC_AUTH";
  if (relativeFile === "app/api/inventory/sync/execute/route.ts") return "PUBLIC_RETIRED";
  if (relativeFile === "app/api/client-errors/route.ts") return "AUTHENTICATED";
  return "ADMIN";
}

export function classifyRouteStatus(
  intendedAccess: IntendedAccess,
  guardKind: GuardKind,
  guardEnforced: boolean,
): RouteStatus {
  if (intendedAccess === "PUBLIC_AUTH") return "INTENTIONAL_PUBLIC";
  if (intendedAccess === "PUBLIC_RETIRED") return "RETIRED";
  if (!guardEnforced) return "UNGUARDED_ROUTE";
  if (intendedAccess === "ADMIN" && guardKind !== "ADMIN") return "UNGUARDED_ROUTE";
  return "GUARDED";
}
