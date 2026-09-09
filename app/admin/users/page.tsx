import { getUsers } from "./actions";
import UsersClient from "./components/UsersClient";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [users, auth] = await Promise.all([getUsers(), resolveActor()]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deleteUserAction is what
  // actually blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  return <UsersClient users={users} canDelete={canDelete} />;
}
