"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { saveCategory, updateCategory } from "@/app/admin/products/categories/actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import type { DBProductCategory } from "@/types/db";

interface ProductCategoryFormProps {
  initialData?: DBProductCategory;
  returnTo?: string;
}

export function ProductCategoryForm({ initialData, returnTo: rawReturnTo }: ProductCategoryFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/products/categories");
  const formId = useId();
  const router = useRouter();
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    if (isEdit && initialData) {
      formData.append("id", initialData.id);
    }
    const fn = isEdit ? updateCategory : saveCategory;
    const res = await fn(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(returnTo);
      router.refresh();
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl">
      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
        )}
        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">
            Tên Danh Mục
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            name="name"
            required
            defaultValue={initialData?.name}
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
            placeholder="VD: Cà phê, Trà sữa..."
          />
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
            loading={loading}
            loadingText="Đang lưu..."
            className="w-full sm:w-auto min-h-[44px]"
          >
            {isEdit ? "Cập nhật" : "Lưu Danh Mục"}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
