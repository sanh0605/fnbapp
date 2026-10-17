import { notFound } from "next/navigation";
import { resolveActor } from "@/lib/auth/auth";
import { getUserById } from "@/app/admin/users/actions";
import EditUserForm from "@/app/admin/users/components/EditUserForm";
import { safeReturnTo } from "@/lib/shared/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { staffLabel } from "@/lib/auth/staff-label";

export const dynamic = "force-dynamic";

export default async function EditUserPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams?: Promise<{ returnTo?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined, "/admin/users");
  const [user, auth] = await Promise.all([
    getUserById(params.id),
    resolveActor(),
  ]);

  if (!user) {
    notFound();
  }

  const canGrantAdmin = Boolean(
    auth.ok && (auth.actor.role === "ADMIN" || auth.actor.role === "SYSTEM")
  );

  if (!canGrantAdmin && user.role === "ADMIN") {
    notFound();
  }

  const ownDetailPath = `/admin/users/${encodeURIComponent(user.id)}`;
  const ownDetailPathRaw = `/admin/users/${user.id}`;
  const isOwnDetail =
    rawReturnTo === ownDetailPath ||
    rawReturnTo.startsWith(`${ownDetailPath}?`) ||
    rawReturnTo === ownDetailPathRaw ||
    rawReturnTo.startsWith(`${ownDetailPathRaw}?`);

  const listReturnTo = rawReturnTo.startsWith("/admin/users/")
    ? "/admin/users"
    : rawReturnTo;

  const detailHref = isOwnDetail
    ? rawReturnTo
    : `/admin/users/${encodeURIComponent(user.id)}?returnTo=${encodeURIComponent(listReturnTo)}`;

  const { name, showLogin } = staffLabel(user);

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={name}
        title="Chỉnh sửa"
        subtitle={showLogin ? `${name} · ${user.username}` : user.username}
      />
      <EditUserForm user={user} returnTo={detailHref} canGrantAdmin={canGrantAdmin} />
    </DetailFrame>
  );
}
