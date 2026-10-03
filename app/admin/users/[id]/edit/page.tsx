import { notFound } from "next/navigation";
import { getUserById } from "@/app/admin/users/actions";
import EditUserForm from "@/app/admin/users/components/EditUserForm";
import { safeReturnTo } from "@/app/admin/users/components/return-to";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { returnTo?: string };
}) {
  const rawReturnTo = safeReturnTo(
    typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined
  );
  const user = await getUserById(params.id);

  if (!user) {
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

  return (
    <DetailFrame>
      <DetailHeader
        backHref={detailHref}
        backLabel={user.username}
        title="Chỉnh sửa"
        subtitle={user.username}
      />
      <EditUserForm user={user} returnTo={detailHref} />
    </DetailFrame>
  );
}
