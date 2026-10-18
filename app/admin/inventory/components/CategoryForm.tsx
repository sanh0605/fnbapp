"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addItemCategory, updateItemCategory } from "@/app/admin/inventory/actions";
import { alert } from "@/lib/shared/dialog";
import { safeReturnTo } from "@/lib/shared/return-to";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { FormActionBar } from "@/components/ui/FormActionBar";

const TYPE_EXPLANATIONS: Record<string, string> = {
  RAW: "Có tính quy đổi, có trong công thức",
  CONSUMABLE: "Kiểm kê định kỳ",
  EQUIPMENT: "Theo dõi ở mục Tài sản",
};

interface CategoryFormProps {
  initialData?: any;
  returnTo?: string;
}

export function CategoryForm({ initialData, returnTo: rawReturnTo }: CategoryFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/inventory/categories");
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [systemType, setSystemType] = useState<string>(initialData?.system_type || "RAW");
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
          hint={TYPE_EXPLANATIONS[systemType]}
        >
          <Select
            id={`${formId}-system_type`}
            name="system_type"
            value={systemType}
            onChange={(e) => setSystemType(e.target.value)}
          >
            <option value="RAW">Nguyên liệu</option>
            <option value="CONSUMABLE">Vật tư</option>
            <option value="EQUIPMENT">Dụng cụ</option>
          </Select>
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

