"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addOutlet, editOutlet } from "@/app/admin/outlets/actions";
import { nextOutletCode } from "@/lib/catalog/outlet-code";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { pickerDateToIsoDay, isoDayToPickerDate } from "@/components/ui/picker-date";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { alert } from "@/lib/shared/dialog";
import { safeReturnTo } from "./return-to";
import type { DBOutlet, DBBrand } from "@/types/db";

// <input type="time"> wants "HH:MM"; Postgres time comes back "HH:MM:SS".
function toTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

interface OutletFormProps {
  initialData?: DBOutlet;
  brands: DBBrand[];
  // All outlets -- used only to preview the code a new outlet will get
  // (plan section 2: "Show the code that will be assigned before saving").
  outlets: DBOutlet[];
  returnTo?: string;
}

export function OutletForm({ initialData, brands, outlets, returnTo: rawReturnTo }: OutletFormProps) {
  const returnTo = safeReturnTo(rawReturnTo);
  const isEdit = !!initialData;
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(initialData?.brand_id || "");
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => isoDayToPickerDate(initialData?.start_date));

  const previewCode = isEdit ? initialData!.code : nextOutletCode(outlets.map(o => o.code));

  // section B: revalidatePath (in editOutlet/addOutlet) marks the server
  // cache stale but does not repaint this already-open page.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);

    if (selectedDate) {
      formData.set("start_date", pickerDateToIsoDay(selectedDate));
    } else {
      formData.delete("start_date");
    }

    if (isEdit && initialData) {
      formData.set("id", initialData.id);
      const res = await editOutlet(formData);
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push(returnTo);
      router.refresh();
      return;
    }

    const res = await addOutlet(formData);
    setLoading(false);
    if (res.error) {
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

        {isEdit ? (
          <p className="text-sm text-text-secondary bg-surface-secondary rounded-lg px-3 py-2">
            Mã điểm bán <span className="font-mono font-semibold">{previewCode}</span> không đổi được -- mã này nằm
            trong mã đơn của mọi đơn hàng bán tại điểm bán này.
          </p>
        ) : (
          <p className="text-sm text-text-secondary bg-surface-secondary rounded-lg px-3 py-2">
            Mã điểm bán sẽ được gán tự động: <span className="font-mono font-semibold">{previewCode}</span>
          </p>
        )}

        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">
            Tên điểm bán
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            name="name"
            required
            defaultValue={initialData?.name}
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="VD: Điểm bán 3"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-brand`} className="block text-sm font-medium text-text-secondary mb-1">
            Thương hiệu
          </label>
          <select
            id={`${formId}-brand`}
            name="brand_id"
            required
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary"
          >
            <option value="" disabled>-- Chọn thương hiệu --</option>
            {brands.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${formId}-address`} className="block text-sm font-medium text-text-secondary mb-1">
            Địa chỉ
          </label>
          <input
            id={`${formId}-address`}
            type="text"
            name="address"
            defaultValue={initialData?.address}
            className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="VD: 123 Đường ABC, Quận 1"
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${formId}-open-time`} className="block text-sm font-medium text-text-secondary mb-1">
              Giờ mở cửa
            </label>
            <input
              id={`${formId}-open-time`}
              type="time"
              name="open_time"
              defaultValue={toTimeInputValue(initialData?.open_time)}
              className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-close-time`} className="block text-sm font-medium text-text-secondary mb-1">
              Giờ đóng cửa
            </label>
            <input
              id={`${formId}-close-time`}
              type="time"
              name="close_time"
              defaultValue={toTimeInputValue(initialData?.close_time)}
              className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            />
          </div>
        </div>
        <p className="text-xs text-text-muted">
          Để trống nếu chưa muốn hệ thống nhắc giờ mở/đóng cửa cho điểm bán này.
        </p>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium transition text-center min-h-[44px]"
          >
            Bỏ
          </button>
          <LoadingButton type="submit" loading={loading} loadingText="Đang lưu…" className="w-full sm:w-auto min-h-[44px]">
            {isEdit ? "Cập nhật" : "Lưu điểm bán"}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
