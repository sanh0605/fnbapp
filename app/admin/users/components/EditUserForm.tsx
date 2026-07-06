"use client";

import { useState, useId } from "react";
import { updateUser } from "../actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { DBUser } from "@/types/db";

interface EditUserFormProps {
  user: DBUser;
}

export default function EditUserForm({ user }: EditUserFormProps) {
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    formData.append("id", user.id);
    const res = await updateUser(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push("/admin/users");
      router.refresh();
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl mx-auto">
      <form action={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}
        
        <div>
          <label htmlFor={`${formId}-username`} className="block text-sm font-medium text-gray-700 mb-1">
            Tên đăng nhập
          </label>
          <input
            id={`${formId}-username`}
            type="text"
            disabled
            value={user.username}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-500 outline-none"
          />
          <p className="text-[10px] text-gray-400 mt-1">Tên đăng nhập không thể thay đổi.</p>
        </div>

        <div>
          <label htmlFor={`${formId}-password`} className="block text-sm font-medium text-gray-700 mb-1">
            Mật khẩu mới (Để trống nếu không muốn đổi)
          </label>
          <input
            id={`${formId}-password`}
            type="password"
            name="password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-gray-900"
            placeholder="******"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-role`} className="block text-sm font-medium text-gray-700 mb-1">
            Quyền hạn
          </label>
          <select
            id={`${formId}-role`}
            name="role"
            required
            defaultValue={user.role}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 bg-white text-gray-900"
          >
            <option value="STAFF">Nhân viên (STAFF)</option>
            <option value="MANAGER">Quản lý (MANAGER)</option>
            <option value="ADMIN">Quản trị viên (ADMIN)</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Link
            href="/admin/users"
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
          >
            Hủy bỏ
          </Link>
          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Đang cập nhật..."
          >
            Cập nhật nhân sự
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
