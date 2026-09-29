import { getUserById } from "../../actions";
import EditUserForm from "../../components/EditUserForm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/ui/BackLink";

export const dynamic = "force-dynamic";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const user = await getUserById(params.id);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <BackLink href="/admin/users" label="Nhân sự" />

      <div>
        <h1 className="text-2xl font-bold text-text-primary">Chỉnh sửa nhân sự: {user.username}</h1>
        <p className="text-sm text-text-muted mt-1">Cập nhật quyền hạn hoặc thay đổi mật khẩu cho tài khoản này.</p>
      </div>

      <EditUserForm user={user} />
    </div>
  );
}
