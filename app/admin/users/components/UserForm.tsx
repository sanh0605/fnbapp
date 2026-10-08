"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addUser } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
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
        <Field label="Tên đăng nhập" htmlFor={`${formId}-username`} required>
          <TextInput
            id={`${formId}-username`}
            name="username"
            required
            placeholder="Ví dụ: nhanvien01"
          />
        </Field>
        <Field label="Mật khẩu" htmlFor={`${formId}-password`} required>
          <TextInput
            id={`${formId}-password`}
            type="password"
            name="password"
            required
            placeholder="******"
          />
        </Field>
        <Field label="Quyền hạn" htmlFor={`${formId}-role`} required>
          <Select
            id={`${formId}-role`}
            name="role"
            required
            defaultValue="STAFF"
          >
            <option value="STAFF">Nhân viên</option>
            <option value="MANAGER">Quản lý</option>
            <option value="ADMIN">Quản trị viên</option>
          </Select>
        </Field>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto"
          >
            Bỏ
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full sm:w-auto"
          >
            Lưu Nhân Sự
          </Button>
        </div>
      </form>
    </div>
  );
}
