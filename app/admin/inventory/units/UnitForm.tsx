"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addUnit, updateUnit } from "@/app/admin/inventory/actions";
import { alert } from "@/lib/shared/dialog";
import { safeReturnTo } from "@/lib/shared/return-to";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { FormActionBar } from "@/components/ui/FormActionBar";

interface UnitFormProps {
  initialData?: any;
  returnTo?: string;
}

export function UnitForm({ initialData, returnTo: rawReturnTo }: UnitFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/inventory/units");
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
      res = await updateUnit(formData);
    } else {
      res = await addUnit(formData);
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
          label="Tên đơn vị"
          htmlFor={`${formId}-name`}
          hint="Ví dụ: gram, hộp"
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
          label="Ghi chú thêm"
          htmlFor={`${formId}-description`}
          hint="Không bắt buộc"
        >
          <TextInput
            id={`${formId}-description`}
            type="text"
            name="description"
            defaultValue={initialData?.description}
            placeholder="Ví dụ: dùng cho sữa đặc"
          />
        </Field>
        <FormActionBar
          mode={isEdit ? "edit" : "create"}
          loading={loading}
          onCancel={() => router.push(returnTo)}
        />
      </form>
    </div>
  );
}
