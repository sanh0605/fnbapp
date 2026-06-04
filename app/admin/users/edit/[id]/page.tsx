import { findAll } from "@/lib/sheets_db";
import EditUserForm from "@/components/EditUserForm";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const users = await findAll("Users");
  const user = users.find((u: any) => u.id === params.id);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/admin/users" className="hover:text-blue-600 transition-colors">Quản lý Nhân sự</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Sửa nhân sự</span>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Sửa Thông Tin Nhân Sự</h1>
        <p className="text-gray-500 mt-1">Cập nhật mật khẩu hoặc phân quyền cho tài khoản {user.username}.</p>
      </div>

      <EditUserForm user={user} />
    </div>
  );
}
