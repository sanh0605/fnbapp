import { getUsers } from "@/app/admin/users/actions";
import UsersClient from "@/app/admin/users/components/UsersClient";
import { resolveActor } from "@/lib/auth/auth";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const [users, auth] = await Promise.all([getUsers(), resolveActor()]);
  // BR-ACCESS-003: permanent deletion is ADMIN only -- hiding the button is
  // courtesy, the server-side requireOwner() in deleteUserAction is what
  // actually blocks it.
  const canDelete = auth.ok && auth.actor.role === "ADMIN";
  const q = typeof searchParams?.q === "string" ? searchParams.q : "";
  const role = typeof searchParams?.role === "string" ? searchParams.role : "ALL";

  return <UsersClient users={users} canDelete={canDelete} initialFilters={{ q, role }} />;
}
