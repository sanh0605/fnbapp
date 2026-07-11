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
    <div className="bg-surface-card rounded-2xl shadow-sm border border-border p-6 max-w-2xl mx-auto">
      <form action={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
        )}
        
        <div>
          <label htmlFor={`${formId}-username`} className="block text-sm font-medium text-text-secondary mb-1">
            Tên đăng nhập
          </label>
          <input
            id={`${formId}-username`}
            type="text"
            disabled
            value={user.username}
            className="w-full border border-border rounded-lg px-3 py-2 bg-surface-secondary text-text-muted outline-none"
          />
          <p className="text-[10px] text-text-muted mt-1">Tên đăng nhập không thể thay đổi.</p>
        </div>

        <div>
          <label htmlFor={`${formId}-password`} className="block text-sm font-medium text-text-secondary mb-1">
            Mật khẩu mới (Để trống nếu không muốn đổi)
          </label>
          <input
            id={`${formId}-password`}
            type="password"
            name="password"
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="******"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-role`} className="block text-sm font-medium text-text-secondary mb-1">
            Quyền hạn
          </label>
          <select
            id={`${formId}-role`}
            name="role"
            required
            defaultValue={user.role}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary"
          >
            <option value="STAFF">Nhân viên (STAFF)</option>
            <option value="MANAGER">Quản lý (MANAGER)</option>
            <option value="ADMIN">Quản trị viên (ADMIN)</option>
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Link
            href="/admin/users"
            className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium transition"
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
