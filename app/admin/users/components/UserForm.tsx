"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addUser, deleteUserAction } from "@/app/admin/users/actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { alert } from "@/lib/shared/dialog";
import { safeReturnTo } from "./return-to";

interface UserFormProps {
  returnTo?: string;
}

export function UserForm({ returnTo: rawReturnTo }: UserFormProps = {}) {
  const returnTo = safeReturnTo(rawReturnTo);
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // section B: revalidatePath (in addUser) marks the server cache stale
  // but does not repaint this already-open page.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const res = await addUser(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(returnTo);
      router.refresh();
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl shadow-sm">
      <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
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
            name="username"
            required
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="VD: nhanvien01"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-password`} className="block text-sm font-medium text-text-secondary mb-1">
            Mật khẩu
          </label>
          <input
            id={`${formId}-password`}
            type="password"
            name="password"
            required
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
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
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary"
          >
            <option value="STAFF">Nhân viên (STAFF)</option>
            <option value="MANAGER">Quản lý (MANAGER)</option>
            <option value="ADMIN">Quản trị viên (ADMIN)</option>
          </select>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium transition text-center min-h-[44px]"
          >
            Bỏ
          </button>
          <LoadingButton
            type="submit"
            form="user-form"
            loading={loading}
            loadingText="Đang lưu..."
            className="w-full sm:w-auto min-h-[44px]"
          >
            Lưu Nhân Sự
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}

interface DeleteUserButtonProps {
  id: string;
  username: string;
}

export function DeleteUserButton({ id, username }: DeleteUserButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // section A4b/B: the action's result was discarded -- a refusal failed in
  // total silence, and a successful delete never told the browser to
  // redraw.
  async function handleDelete() {
    setLoading(true);
    const formData = new FormData();
    formData.append("id", id);
    const res = await deleteUserAction(formData);
    setLoading(false);
    if (res?.error) {
      await alert({ title: "Không xoá được", message: res.error, variant: "danger" });
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 min-h-[44px] bg-danger/10 hover:bg-danger/20 border border-danger/20 text-danger font-bold text-xs rounded-lg transition active:scale-95 inline-flex items-center"
      >
        Xóa
      </button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description={`Bạn có chắc chắn muốn xóa nhân sự "${username}"?`}
      />
    </>
  );
}
