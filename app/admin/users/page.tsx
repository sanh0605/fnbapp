import { Suspense } from "react";
import { resolveActor } from "@/lib/auth/auth";
import { getUsers } from "@/app/admin/users/actions";
import UsersClient from "./components/UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: { q?: string; role?: string; page?: string };
}) {
  const [users, auth] = await Promise.all([getUsers(), resolveActor()]);
  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");
  const canGrantAdmin = Boolean(
    auth.ok && (auth.actor.role === "ADMIN" || auth.actor.role === "SYSTEM")
  );

  return (
    <Suspense fallback={<div>Đang tải...</div>}>
      <UsersClient
        users={users}
        canDelete={canDelete}
        canGrantAdmin={canGrantAdmin}
        initialSearch={typeof searchParams?.q === "string" ? searchParams.q : undefined}
        initialRole={typeof searchParams?.role === "string" ? searchParams.role : undefined}
        initialPage={typeof searchParams?.page === "string" ? searchParams.page : undefined}
      />
    </Suspense>
  );
}
