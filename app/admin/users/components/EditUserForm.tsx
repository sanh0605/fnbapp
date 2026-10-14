"use client";

import { useState, useId } from "react";
import { updateUser } from "@/app/admin/users/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { useRouter } from "next/navigation";
import { safeReturnTo } from "./return-to";
import type { DBUser } from "@/types/db";

interface EditUserFormProps {
  user: DBUser;
  returnTo?: string;
  canGrantAdmin?: boolean;
}

export default function EditUserForm({
  user,
  returnTo: rawReturnTo,
  canGrantAdmin = true,
}: EditUserFormProps) {
  const returnTo = safeReturnTo(rawReturnTo);
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    formData.append("id", user.id);
    const res = await updateUser(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(returnTo);
      router.refresh();
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
        )}

        <div data-testid="form-fields" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Field
            label="Tên đăng nhập"
            htmlFor={`${formId}-username`}
            hint="Tên đăng nhập không thể thay đổi."
          >
            <TextInput
              id={`${formId}-username`}
              disabled
              value={user.username}
            />
          </Field>

          <Field
            label="Mật khẩu mới"
            htmlFor={`${formId}-password`}
            hint="Để trống nếu không muốn đổi."
          >
            <TextInput
              id={`${formId}-password`}
              type="password"
              name="password"
              placeholder="******"
            />
          </Field>

          <Field label="Quyền hạn" htmlFor={`${formId}-role`} required>
            <Select
              id={`${formId}-role`}
              name="role"
              required
              defaultValue={user.role}
            >
              <option value="STAFF">Nhân viên</option>
              <option value="MANAGER">Quản lý</option>
              {canGrantAdmin && <option value="ADMIN">Quản trị viên</option>}
            </Select>
          </Field>
        </div>

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
            Cập nhật nhân sự
          </Button>
        </div>
      </form>
    </div>
  );
}
