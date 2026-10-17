"use client";

import { useState, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import { saveProductType, updateProductType } from "@/app/admin/products/types/actions";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Alert } from "@/components/ui/Alert";
import { FormActionBar } from "@/components/ui/FormActionBar";
import type { DBProductType } from "@/types/db";

interface ProductTypeFormProps {
  initialData?: DBProductType;
  returnTo?: string;
}

export function ProductTypeForm({ initialData, returnTo = "/admin/products/types" }: ProductTypeFormProps) {
  const formId = useId();
  const router = useRouter();
  const isEdit = !!initialData;
  const [loading, setLoading] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingRef.current) return;

    const formData = new FormData(e.currentTarget);
    savingRef.current = true;
    setLoading(true);
    setError(null);

    if (isEdit && initialData) {
      formData.set("id", initialData.id);
    }

    // actions.ts reads: formData.get("is_drink") === "on"
    const isDrinkChecked = formData.get("is_drink") === "true" || formData.get("is_drink") === "on";
    if (isDrinkChecked) {
      formData.set("is_drink", "on");
    } else {
      formData.delete("is_drink");
    }

    const fn = isEdit ? updateProductType : saveProductType;
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
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}
        <div data-testid="form-fields" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Tên loại món" htmlFor={`${formId}-name`} required>
            <TextInput
              id={`${formId}-name`}
              name="name"
              required
              defaultValue={initialData?.name}
              example="Thức uống"
            />
          </Field>
          <div className="flex items-center pt-2 md:pt-7">
            <label
              htmlFor={`${formId}-is_drink`}
              className="flex items-center gap-2 cursor-pointer text-sm font-medium text-text-primary min-h-[48px] md:min-h-[40px]"
            >
              <input
                type="checkbox"
                id={`${formId}-is_drink`}
                name="is_drink"
                value="true"
                defaultChecked={initialData?.is_drink ?? false}
                className="w-6 h-6 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
              />
              <span>Là thức uống (tính là ly)</span>
            </label>
          </div>
        </div>
        <FormActionBar
          mode={isEdit ? "edit" : "create"}
          loading={loading}
          onCancel={() => router.push(returnTo)}
        />
      </form>
    </div>
  );
}
