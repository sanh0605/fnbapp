"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addBrand, editBrand } from "@/app/admin/brands/actions";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { pickerDateToIsoDay, isoDayToPickerDate } from "@/components/ui/picker-date";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { alert } from "@/lib/shared/dialog";
import { safeReturnTo } from "./return-to";
import type { DBBrand } from "@/types/db";

interface BrandFormProps {
  initialData?: DBBrand;
  returnTo?: string;
}

export function BrandForm({ initialData, returnTo: rawReturnTo }: BrandFormProps) {
  const returnTo = safeReturnTo(rawReturnTo);
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
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
        )}
        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">
            Tên Thương Hiệu
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            name="name"
            required
            defaultValue={initialData?.name}
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="VD: Phin Di"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-code`} className="block text-sm font-medium text-text-secondary mb-1">
            Mã Đơn Hàng (3 ký tự)
          </label>
          <input
            id={`${formId}-code`}
            type="text"
            name="code"
            maxLength={3}
            required
            defaultValue={initialData?.code}
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring uppercase text-text-primary"
            placeholder="VD: PHD"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-start-date`} className="block text-sm font-medium text-text-secondary mb-1">
            Ngày bắt đầu hoạt động
          </label>
          <CustomDatePicker
            id={`${formId}-start-date`}
            selected={selectedDate}
            onChange={(date: Date | null) => setSelectedDate(date)}
            dateFormat="dd/MM/yyyy"
            showTimeSelect={false}
            placeholderText="DD/MM/YYYY"
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
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
            loadingText="Đang lưu…"
            className="w-full sm:w-auto min-h-[44px]"
          >
            {isEdit ? "Cập nhật" : "Lưu Thương Hiệu"}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
