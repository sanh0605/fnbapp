import { findAll } from "@/lib/db/tables";

export interface StaffNameUser { id: string; username: string; name?: string | null }
// Display only: stored created_by_name stays the login; screens show users.name instead.
export type StaffNameResolver = (stored: string | null | undefined, id?: string | null) => string | null;

// Resolves by id first, then by login; no match or a blank name keeps the stored text.
export function buildStaffNameResolver(users: StaffNameUser[]): StaffNameResolver {
  const named = users.filter(u => u.name?.trim());
  const byId = new Map(named.map(u => [u.id, u.name!.trim()]));
  const byLogin = new Map(named.map(u => [u.username, u.name!.trim()]));
  return (stored, id) => (id ? byId.get(id) : undefined) ?? (stored ? byLogin.get(stored) : undefined) ?? stored ?? null;
}

// One read of users per call: call once per page load, not per row.
export async function loadStaffNameResolver(): Promise<StaffNameResolver> {
  return buildStaffNameResolver(await findAll("Users") as StaffNameUser[]);
}
