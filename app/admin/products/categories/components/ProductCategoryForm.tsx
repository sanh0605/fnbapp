"use client";

import { useState, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveCategory, updateCategory } from "@/app/admin/products/categories/actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { safeReturnTo } from "@/app/admin/products/components/return-to";
import type { DBProductCategory, DBProductType } from "@/types/db";

interface ProductCategoryFormProps {
  initialData?: DBProductCategory;
  types: DBProductType[];
  returnTo?: string;
}

export function ProductCategoryForm({ initialData, types = [], returnTo: rawReturnTo }: ProductCategoryFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/products/categories");
  const formId = useId();
  const router = useRouter();
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    if (savingRef.current) return;
    savingRef.current = true;
    setLoading(true);
    setError(null);
    if (isEdit && initialData) {
      formData.append("id", initialData.id);
    }
    const fn = isEdit ? updateCategory : saveCategory;
    try {
      const res = await fn(formData);
      if (res?.error) {
        savingRef.current = false;
        setLoading(false);
        setError(res.error);
        return;
      }
      router.push(returnTo);
      router.refresh();
    } catch {
      savingRef.current = false;
      setLoading(false);
      setError("Không lưu được. Kiểm tra mạng rồi bấm lại.");
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
      <form action={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
        )}
        <div data-testid="form-fields" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Tên nhóm món" htmlFor={`${formId}-name`}>
            <TextInput
              id={`${formId}-name`}
              name="name"
              required
              defaultValue={initialData?.name}
              example="Cà phê"
            />
          </Field>
          <Field label="Loại món" htmlFor={`${formId}-type_id`} required>
            <Select
              id={`${formId}-type_id`}
              name="type_id"
              required
              defaultValue={initialData?.type_id ?? ""}
            >
              <option value="" disabled>Chọn loại món</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
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
            {isEdit ? "Cập nhật" : "Tạo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
