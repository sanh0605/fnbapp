"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addOutlet, editOutlet, retireOutlet } from "@/app/admin/outlets/actions";
import { nextOutletCode } from "@/lib/catalog/outlet-code";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { confirm, alert } from "@/lib/shared/dialog";
import { safeReturnTo } from "./return-to";
import type { DBOutlet, DBBrand } from "@/types/db";

function formatDateToYYYYMMDD(date: Date): string {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split("T")[0];
}

function parseYYYYMMDD(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => parseYYYYMMDD(initialData?.start_date));

  const previewCode = isEdit ? initialData!.code : nextOutletCode(outlets.map(o => o.code));

  // section B: revalidatePath (in editOutlet/addOutlet) marks the server
  // cache stale but does not repaint this already-open page.
  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (selectedDate) formData.set("start_date", formatDateToYYYYMMDD(selectedDate));

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
      <form id={formId} action={handleSubmit} className="space-y-4">
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
          <LoadingButton type="submit" form={formId} loading={loading} loadingText="Đang lưu…" className="w-full sm:w-auto min-h-[44px]">
            {isEdit ? "Cập nhật" : "Lưu điểm bán"}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}

interface RetireOutletButtonProps {
  outlet: DBOutlet;
}

// Never deletes -- calls retireOutlet, which sets status/end_date only
// (plan section 2). The server refuses the last active outlet; that refusal
// is surfaced here rather than pre-checked client-side, so the rule lives
// in exactly one place.
export function RetireOutletButton({ outlet }: RetireOutletButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (outlet.status !== "ACTIVE") return null;

  // section B: outlet is a server-fetched prop -- without this, the button
  // above stays visible (still reading the stale ACTIVE status) after a
  // successful retire, until the owner navigates away and back.
  async function handleRetire() {
    const approved = await confirm({
      title: "Ngừng hoạt động điểm bán",
      message: `Ngừng hoạt động "${outlet.name}"? Điểm bán sẽ không còn dùng để mở máy POS, nhưng dữ liệu và mã ${outlet.code} vẫn được giữ nguyên.`,
      okText: "Ngừng hoạt động",
      cancelText: "Huỷ",
      variant: "warning",
    });
    if (!approved) return;

    setLoading(true);
    const formData = new FormData();
    formData.set("id", outlet.id);
    const res = await retireOutlet(formData);
    setLoading(false);

    if (res.error) {
      await alert({ title: "Không thể ngừng hoạt động", message: res.error, variant: "danger" });
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleRetire}
      disabled={loading}
      className="text-danger hover:text-danger-active font-medium text-sm disabled:opacity-50 min-h-[44px] inline-flex items-center"
    >
      {loading ? "…" : "Ngừng hoạt động"}
    </button>
  );
}
