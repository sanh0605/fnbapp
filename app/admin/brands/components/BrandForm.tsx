"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addBrand, editBrand } from "@/app/admin/brands/actions";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { pickerDateToIsoDay, isoDayToPickerDate } from "@/components/ui/picker-date";
import { safeReturnTo } from "@/lib/shared/return-to";
import type { DBBrand } from "@/types/db";

interface BrandFormProps {
  initialData?: DBBrand;
  returnTo?: string;
}

export function BrandForm({ initialData, returnTo: rawReturnTo }: BrandFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/brands");
  const isEdit = !!initialData;
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    isoDayToPickerDate(initialData?.start_date)
  );

  // section A4b/B: found while fixing this file's delete button -- this
  // add/edit handler discarded its result too (via `fn`, not a literal
  // function name, which is why the plan's own grep-based section A4b
  // count missed it), and never told the browser to redraw after a save.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    if (isEdit && initialData) {
      formData.append("id", initialData.id);
    }
    if (selectedDate) {
      formData.set("start_date", pickerDateToIsoDay(selectedDate));
    } else {
      formData.delete("start_date");
    }
    const fn = isEdit ? editBrand : addBrand;
    const res = await fn(formData);
    setLoading(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.push(returnTo);
    router.refresh();
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
          <Field label="Tên thương hiệu" htmlFor={`${formId}-name`} required>
            <TextInput
              id={`${formId}-name`}
              name="name"
              required
              defaultValue={initialData?.name}
              placeholder="Ví dụ: Phin Di"
            />
          </Field>

          <Field label="Mã đơn hàng (3 ký tự)" htmlFor={`${formId}-code`} required>
            <TextInput
              id={`${formId}-code`}
              name="code"
              maxLength={3}
              required
              defaultValue={initialData?.code}
              placeholder="Ví dụ: PHD"
            />
          </Field>

          <Field label="Ngày bắt đầu hoạt động" htmlFor={`${formId}-start-date`}>
            <CustomDatePicker
              id={`${formId}-start-date`}
              selected={selectedDate}
              onChange={(date: Date | null) => setSelectedDate(date)}
              dateFormat="dd/MM/yyyy"
              showTimeSelect={false}
              placeholderText="DD/MM/YYYY"
              className="w-full border border-border rounded-lg px-3 py-2 min-h-[48px] md:min-h-[40px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            />
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
