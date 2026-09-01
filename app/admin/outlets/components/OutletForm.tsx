"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addOutlet, editOutlet, retireOutlet } from "../actions";
import { nextOutletCode } from "@/lib/outlet-code";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { confirm, alert } from "@/lib/dialog";
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
}

// docs/superpowers/plans/2026-08-26-outlet-done-properly.md section 4: the
// edit form shows brand, address, start date and hours, not the name
// alone -- the owner's own verdict on the name-only version was "built to
// look finished rather than to be used". Add and edit share every field
// except code, which only add previews (system-assigned) and edit displays
// (frozen, never posted).
export function OutletForm({ initialData, brands, outlets }: OutletFormProps) {
  const isEdit = !!initialData;
  const formId = useId();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(initialData?.brand_id || "");
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => parseYYYYMMDD(initialData?.start_date));

  const previewCode = isEdit ? initialData!.code : nextOutletCode(outlets.map(o => o.code));

  function resetForNextOpen() {
    setSelectedDate(parseYYYYMMDD(initialData?.start_date));
    setBrandId(initialData?.brand_id || "");
  }

  // Shared by the modal's own close affordances (backdrop, Escape, the X
  // button, via FormModal's onClose) and the footer's "Huy" button, which
  // does not go through onClose -- state must reset on every path or a
  // cancelled edit's unsaved date/brand would leak into the next open.
  function handleClose() {
    setIsOpen(false);
    setError(null);
    resetForNextOpen();
  }

  // docs/superpowers/plans/2026-09-01-two-defects-the-owner-found-testing.md
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
      setIsOpen(false);
      router.refresh();
      return;
    }

    const res = await addOutlet(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setIsOpen(false);
    setSelectedDate(null);
    setBrandId("");
    router.refresh();
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-primary hover:text-primary-hover font-medium text-sm"
        >
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition"
        >
          + Thêm Điểm Bán
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        title={isEdit ? "Sửa điểm bán" : "Thêm điểm bán mới"}
        footer={
          <>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium"
            >
              Huỷ
            </button>
            <LoadingButton type="submit" form={formId} loading={loading} loadingText="Đang lưu…">
              {isEdit ? "Cập nhật" : "Lưu điểm bán"}
            </LoadingButton>
          </>
        }
      >
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
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
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
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary"
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
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
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
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${formId}-open-time`} className="block text-sm font-medium text-text-secondary mb-1">
                Giờ mở cửa
              </label>
              <input
                id={`${formId}-open-time`}
                type="time"
                name="open_time"
                defaultValue={toTimeInputValue(initialData?.open_time)}
                className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
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
                className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              />
            </div>
          </div>
          <p className="text-xs text-text-muted -mt-2">
            Để trống nếu chưa muốn hệ thống nhắc giờ mở/đóng cửa cho điểm bán này.
          </p>
        </form>
      </FormModal>
    </>
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

  // docs/superpowers/plans/2026-09-01-two-defects-the-owner-found-testing.md
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
      className="text-danger hover:text-danger-active font-medium text-sm disabled:opacity-50"
    >
      {loading ? "…" : "Ngừng hoạt động"}
    </button>
  );
}
