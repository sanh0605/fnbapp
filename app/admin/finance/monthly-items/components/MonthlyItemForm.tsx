"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createMonthlyItem, updateMonthlyItem } from "../actions";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import type { DBCashCategory, DBMonthlyExpenseItem } from "@/types/db";

export interface MonthlyItemFormProps {
  item?: DBMonthlyExpenseItem;
  categories: DBCashCategory[];
  returnTo?: string;
}

export function MonthlyItemForm({ item, categories, returnTo = "/admin/finance/monthly-items" }: MonthlyItemFormProps) {
  const isEdit = !!item;
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields: only ACTIVE groups whose kind is "EXPENSE", plus the edited item's own group
  const expenseCategories = categories.filter(
    (c) => (c.kind === "EXPENSE" && c.status === "ACTIVE") || c.id === item?.cash_category_id,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingRef.current) return;
    const formData = new FormData(e.currentTarget);
    savingRef.current = true;
    setLoading(true);
    setError(null);

    if (isEdit && item) formData.set("id", item.id);
    try {
      const result = isEdit ? await updateMonthlyItem(formData) : await createMonthlyItem(formData);
      if (result.error) {
        savingRef.current = false;
        setLoading(false);
        setError(result.error);
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
          <Field label="Tên khoản" htmlFor={`${formId}-name`} required>
            <TextInput
              id={`${formId}-name`}
              name="name"
              required
              defaultValue={item?.name ?? ""}
              example="Tiền điện"
            />
          </Field>

          <Field label="Nhóm chi" htmlFor={`${formId}-cash_category_id`} required>
            <Select
              id={`${formId}-cash_category_id`}
              name="cash_category_id"
              required
              defaultValue={item?.cash_category_id ?? ""}
            >
              <option value="" disabled>Chọn nhóm</option>
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
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
