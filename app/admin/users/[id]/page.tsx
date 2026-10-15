import { notFound } from "next/navigation";
import { resolveActor } from "@/lib/auth/auth";
import { getUserById } from "@/app/admin/users/actions";
import { safeReturnTo } from "@/app/admin/users/components/return-to";
import { UserDetailView } from "./components/UserDetailView";

export const dynamic = "force-dynamic";

export default async function UserDetailPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [user, auth] = await Promise.all([
    getUserById(params.id),
    resolveActor(),
  ]);

  if (!user) {
    notFound();
  }

  const canDelete = Boolean(auth.ok && auth.actor.role === "ADMIN");
  const canGrantAdmin = Boolean(
    auth.ok && (auth.actor.role === "ADMIN" || auth.actor.role === "SYSTEM")
  );

  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined
  );
  const returnTo = rawReturnTo.startsWith("/admin/users/")
    ? "/admin/users"
    : rawReturnTo;

  return (
    <UserDetailView
      user={user}
      returnTo={returnTo}
      canDelete={canDelete}
      canGrantAdmin={canGrantAdmin}
    />
  );
}
