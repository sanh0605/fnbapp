"use server";

import { resolveActor } from "@/lib/auth/auth";
import { loadStaffNameResolver } from "@/lib/auth/staff-names";

// Display name of the signed-in person for the sidebar and More sheet. The session
// keeps the login as its name (it is what gets stored on records), so read users.name here.
export async function getMyStaffName(): Promise<string | null> {
  const auth = await resolveActor();
  if (!auth.ok) return null;
  return (await loadStaffNameResolver())(auth.actor.name, auth.actor.id);
}
