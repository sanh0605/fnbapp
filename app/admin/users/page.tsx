import { findAll } from "@/lib/sheets_db";
import { UserForm, DeleteUserButton } from "@/components/UserForm";

export default async function UsersPage() {
  const users = await findAll("Users");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Quản lý Nhân sự</h1>
          <p className="text-gray-500 mt-1">Quản lý tài khoản và phân quyền cho nhân viên.</p>
        </div>
        <UserForm />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
              <th className="px-6 py-4 font-medium">ID</th>
              <th className="px-6 py-4 font-medium">Tên Đăng Nhập</th>
              <th className="px-6 py-4 font-medium">Quyền</th>
              <th className="px-6 py-4 font-medium">Ngày Tạo</th>
              <th className="px-6 py-4 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Chưa có dữ liệu nhân sự.
                </td>
              </tr>
            ) : (
              users.map((user: any) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.id}</td>
                  <td className="px-6 py-4 text-sm text-gray-800 font-semibold">{user.username}</td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      user.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                      user.role === 'MANAGER' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString("vi-VN") : "N/A"}
                  </td>
                  <td className="px-6 py-4 text-sm text-right space-x-4">
                    <button className="text-blue-600 hover:text-blue-800 font-medium">Sửa</button>
                    {user.username !== 'admin' && <DeleteUserButton id={user.id} />}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
