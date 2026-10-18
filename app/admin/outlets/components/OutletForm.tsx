"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addOutlet, editOutlet } from "@/app/admin/outlets/actions";
import { nextOutletCode } from "@/lib/catalog/outlet-code";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { DayInput } from "@/components/ui/DayInput";
import { safeReturnTo } from "@/lib/shared/return-to";
import { Alert } from "@/components/ui/Alert";
import type { DBOutlet, DBBrand } from "@/types/db";

// Postgres time comes back "HH:MM:SS" or "HH:MM".
function toTimeInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

const HALF_HOURS: string[] = [];
for (let h = 0; h < 24; h++) {
  const hh = String(h).padStart(2, "0");
  HALF_HOURS.push(`${hh}:00`, `${hh}:30`);
}
const HALF_HOUR_OPTIONS = HALF_HOURS.map((time) => (
  <option key={time} value={time}>
    {time}
  </option>
));

interface OutletFormProps {
  initialData?: DBOutlet;
  brands: DBBrand[];
  // All outlets -- used only to preview the code a new outlet will get
  // (plan section 2: "Show the code that will be assigned before saving").
  outlets: DBOutlet[];
  returnTo?: string;
}

export function OutletForm({ initialData, brands, outlets, returnTo: rawReturnTo }: OutletFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/outlets");
  const isEdit = !!initialData;
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(initialData?.brand_id || "");
  const [startDate, setStartDate] = useState(initialData?.start_date || "");
  const [startDateError, setStartDateError] = useState("");

  const initialOpen = toTimeInputValue(initialData?.open_time);
  const initialClose = toTimeInputValue(initialData?.close_time);

  const previewCode = isEdit ? initialData!.code : nextOutletCode(outlets.map(o => o.code));

  // section B: revalidatePath (in editOutlet/addOutlet) marks the server
  // cache stale but does not repaint this already-open page.
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);

    if (startDate === "invalid") {
      setLoading(false);
      setStartDateError("Ngày không hợp lệ");
      return;
    }
    if (startDate) {
      formData.set("start_date", startDate);
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
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        {isEdit ? (
          <p className="text-sm text-text-secondary bg-surface-secondary rounded-lg px-3 py-2">
            Mã điểm bán <span className="font-semibold">{previewCode}</span> không đổi được, vì mã này nằm
            trong mã đơn của mọi đơn hàng bán tại điểm bán này.
          </p>
        ) : (
          <p className="text-sm text-text-secondary bg-surface-secondary rounded-lg px-3 py-2">
            Mã điểm bán sẽ được gán tự động: <span className="font-semibold">{previewCode}</span>
          </p>
        )}

        <div data-testid="form-fields" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <h3 className="col-span-1 md:col-span-2 text-sm font-semibold text-text-primary">Thông tin</h3>

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
              <option value="" disabled data-placeholder>-- Chọn thương hiệu --</option>
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

          <DayInput
            label="Ngày bắt đầu hoạt động"
            value={startDate}
            onChange={(v) => {
              setStartDate(v);
              setStartDateError("");
            }}
            error={startDateError}
          />

          <h3 className="col-span-1 md:col-span-2 text-sm font-semibold text-text-primary pt-2">Giờ hoạt động</h3>

          <div className="col-span-1 md:col-span-2 space-y-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Giờ mở cửa" htmlFor={`${formId}-open-time`}>
                <Select
                  id={`${formId}-open-time`}
                  name="open_time"
                  defaultValue={initialOpen}
                >
                  <option value="">Chưa đặt</option>
                  {initialOpen && !HALF_HOURS.includes(initialOpen) && (
                    <option value={initialOpen}>{initialOpen}</option>
                  )}
                  {HALF_HOUR_OPTIONS}
                </Select>
              </Field>
              <Field label="Giờ đóng cửa" htmlFor={`${formId}-close-time`}>
                <Select
                  id={`${formId}-close-time`}
                  name="close_time"
                  defaultValue={initialClose}
                >
                  <option value="">Chưa đặt</option>
                  {initialClose && !HALF_HOURS.includes(initialClose) && (
                    <option value={initialClose}>{initialClose}</option>
                  )}
                  {HALF_HOUR_OPTIONS}
                </Select>
              </Field>
            </div>
            <p className="text-[13px] md:text-xs text-text-secondary">
              Để trống nếu chưa muốn hệ thống nhắc giờ mở/đóng cửa cho điểm bán này.
            </p>
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
