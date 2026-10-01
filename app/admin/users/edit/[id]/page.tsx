import { notFound } from "next/navigation";
import { getUserById } from "@/app/admin/users/actions";
import EditUserForm from "@/app/admin/users/components/EditUserForm";
import { safeReturnTo } from "@/app/admin/users/components/return-to";
import { BackLink } from "@/components/ui/BackLink";

export const dynamic = "force-dynamic";

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const returnTo = safeReturnTo(typeof searchParams?.returnTo === "string" ? searchParams.returnTo : undefined);
  const user = await getUserById(params.id);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href={returnTo} label="Nhân sự" />

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Chỉnh sửa nhân sự: {user.username}</h1>
        <p className="text-sm text-text-muted mt-1">Cập nhật quyền hạn hoặc thay đổi mật khẩu cho tài khoản này.</p>
      </div>

      <EditUserForm user={user} returnTo={returnTo} />
    </div>
  );
}
