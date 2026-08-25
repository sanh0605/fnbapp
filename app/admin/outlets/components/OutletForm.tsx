"use client";

import { useState, useId } from "react";
import { addOutlet, renameOutlet, retireOutlet } from "../actions";
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

interface OutletFormProps {
  initialData?: DBOutlet;
  brands: DBBrand[];
  // All outlets -- used only to preview the code a new outlet will get
  // (plan section 2: "Show the code that will be assigned before saving").
  outlets: DBOutlet[];
}

export function OutletForm({ initialData, brands, outlets }: OutletFormProps) {
  const isEdit = !!initialData;
  const formId = useId();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brandId, setBrandId] = useState(initialData?.brand_id || "");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const previewCode = isEdit ? initialData!.code : nextOutletCode(outlets.map(o => o.code));

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (isEdit && initialData) {
      formData.set("id", initialData.id);
      const res = await renameOutlet(formData);
      setLoading(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setIsOpen(false);
      return;
    }

    if (selectedDate) formData.set("start_date", formatDateToYYYYMMDD(selectedDate));
    const res = await addOutlet(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setIsOpen(false);
    setSelectedDate(null);
    setBrandId("");
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-primary hover:text-primary-hover font-medium text-sm"
        >
          Đổi tên
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
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title={isEdit ? "Đổi tên điểm bán" : "Thêm điểm bán mới"}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
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
              Mã điểm bán <span className="font-mono font-semibold">{previewCode}</span> không đổi khi đổi tên.
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

          {!isEdit && (
            <>
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
            </>
          )}
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
  const [loading, setLoading] = useState(false);

  if (outlet.status !== "ACTIVE") return null;

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
    }
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
