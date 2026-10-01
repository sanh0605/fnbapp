"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addItemCategory, updateItemCategory } from "@/app/admin/inventory/actions";
import { alert } from "@/lib/shared/dialog";
import { safeReturnTo } from "./return-to";

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
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-primary mb-1">
            Tên Phân Loại (VD: Nguyên liệu khô, Bao bì)
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            name="name"
            defaultValue={initialData?.name}
            required
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-system_type`} className="block text-sm font-medium text-text-primary mb-1">
            Đặc tính (System Type)
          </label>
          <select
            id={`${formId}-system_type`}
            name="system_type"
            defaultValue={initialData?.system_type}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
          >
            <option value="RAW">Thuộc nhóm Nguyên liệu (Có tính quy đổi, có trong công thức)</option>
            <option value="CONSUMABLE">Thuộc nhóm Vật tư (Kiểm kê định kỳ)</option>
            <option value="EQUIPMENT">Thuộc nhóm Dụng cụ</option>
          </select>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium transition text-center"
          >
            Bỏ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-4 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary-hover disabled:opacity-50 transition"
          >
            {loading ? "Đang lưu..." : isEdit ? "Cập nhật" : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}

// Aliased export for backward compatibility
export { CategoryForm as ItemCategoryForm };
