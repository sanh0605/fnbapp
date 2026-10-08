"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { saveCategory, updateCategory } from "@/app/admin/products/categories/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
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
        <Field label="Tên Danh Mục" htmlFor={`${formId}-name`}>
          <TextInput
            id={`${formId}-name`}
            name="name"
            required
            defaultValue={initialData?.name}
            example="Cà phê"
          />
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
            {isEdit ? "Cập nhật" : "Lưu danh mục"}
          </Button>
        </div>
      </form>
    </div>
  );
}
