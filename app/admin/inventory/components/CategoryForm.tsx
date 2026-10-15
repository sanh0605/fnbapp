"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addItemCategory, updateItemCategory } from "@/app/admin/inventory/actions";
import { alert } from "@/lib/shared/dialog";
import { safeReturnTo } from "./return-to";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CategoryFormProps {
  initialData?: any;
  returnTo?: string;
}

export function CategoryForm({ initialData, returnTo: rawReturnTo }: CategoryFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/inventory/categories");
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    let res;
    if (isEdit) {
      formData.append("id", initialData.id);
      res = await updateItemCategory(formData);
    } else {
      res = await addItemCategory(formData);
    }
    setLoading(false);
    if (res?.error) {
      await alert({ title: "Lỗi", message: res.error, variant: "danger" });
      return;
    }
    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label="Tên phân loại"
          htmlFor={`${formId}-name`}
          hint="Ví dụ: Nguyên liệu khô, Bao bì"
          required
        >
          <TextInput
            id={`${formId}-name`}
            type="text"
            name="name"
            defaultValue={initialData?.name}
            required
          />
        </Field>
        <Field
          label="Đặc tính"
          htmlFor={`${formId}-system_type`}
        >
          <Select
            id={`${formId}-system_type`}
            name="system_type"
            defaultValue={initialData?.system_type}
          >
            <option value="RAW">Thuộc nhóm Nguyên liệu (Có tính quy đổi, có trong công thức)</option>
            <option value="CONSUMABLE">Thuộc nhóm Vật tư (Kiểm kê định kỳ)</option>
            <option value="EQUIPMENT">Thuộc nhóm Dụng cụ</option>
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
            {loading ? "Đang lưu..." : isEdit ? "Cập nhật" : "Lưu"}
          </Button>
        </div>
      </form>
    </div>
  );
}

