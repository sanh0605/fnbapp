"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addOutlet, editOutlet } from "@/app/admin/outlets/actions";
import { nextOutletCode } from "@/lib/catalog/outlet-code";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { pickerDateToIsoDay, isoDayToPickerDate } from "@/components/ui/picker-date";
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
    <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
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

        <div data-testid="form-fields" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Tên điểm bán" htmlFor={`${formId}-name`} required>
            <TextInput
              id={`${formId}-name`}
              name="name"
              required
              defaultValue={initialData?.name}
              placeholder="Ví dụ: Điểm bán 3"
            />
          </Field>

          <Field label="Thương hiệu" htmlFor={`${formId}-brand`} required>
            <Select
              id={`${formId}-brand`}
              name="brand_id"
              required
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="" disabled>-- Chọn thương hiệu --</option>
              {brands.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </Field>

          <Field label="Địa chỉ" htmlFor={`${formId}-address`}>
            <TextInput
              id={`${formId}-address`}
              name="address"
              defaultValue={initialData?.address}
              placeholder="Ví dụ: 123 Đường ABC, Quận 1"
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
              className="w-full border border-border rounded-lg px-3 py-2 min-h-[44px] md:min-h-[40px] outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            />
          </Field>

          <div className="space-y-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Giờ mở cửa" htmlFor={`${formId}-open-time`}>
                <TextInput
                  id={`${formId}-open-time`}
                  type="time"
                  name="open_time"
                  defaultValue={toTimeInputValue(initialData?.open_time)}
                />
              </Field>
              <Field label="Giờ đóng cửa" htmlFor={`${formId}-close-time`}>
                <TextInput
                  id={`${formId}-close-time`}
                  type="time"
                  name="close_time"
                  defaultValue={toTimeInputValue(initialData?.close_time)}
                />
              </Field>
            </div>
            <p className="text-xs text-text-muted">
              Để trống nếu chưa muốn hệ thống nhắc giờ mở/đóng cửa cho điểm bán này.
            </p>
          </div>
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
            {isEdit ? "Cập nhật" : "Lưu điểm bán"}
          </Button>
        </div>
      </form>
    </div>
  );
}
