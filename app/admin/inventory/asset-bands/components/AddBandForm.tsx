"use client";

import { useId, useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Button } from "@/components/ui/Button";
import { createAssetBand } from "../actions";

// 2026-08-23, section 2: "A table the owner cannot add a row to is not the
// settings screen CLAUDE.md section 8 requires; it is a constant with an
// edit box." A new band typically requires narrowing an existing neighbour
// first (createAssetBand validates the whole resulting set and refuses a
// band that overlaps or gaps another).
export function AddBandForm() {
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [termMonths, setTermMonths] = useState("");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const res = await createAssetBand(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
      setMinPrice("");
      setMaxPrice("");
      setTermMonths("");
    }
  }

  return (
    <>
      <Button variant="primary" onClick={() => setIsOpen(true)}>
        + Thêm khung
      </Button>

      <FormModal
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); setError(null); }}
        title="Thêm khung khấu hao"
        footer={
          <LoadingButton type="submit" form={`${formId}-add-band-form`} loading={loading} loadingText="Đang lưu...">
            Lưu
          </LoadingButton>
        }
      >
        <form id={`${formId}-add-band-form`} action={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
              {error}
            </div>
          )}
          <p className="text-xs text-text-muted">
            Khung mới phải khớp khít với các khung hiện có -- không chồng lấn, không để trống khoảng. Thường cần thu hẹp một khung liền kề trước.
          </p>
          <div>
            <label htmlFor={`${formId}-min`} className="block text-sm font-medium text-text-secondary mb-1">
              Giá thấp nhất (đ, tính theo đơn giá 1 cái)
            </label>
            <input
              id={`${formId}-min`}
              name="min_unit_price"
              type="number"
              inputMode="numeric"
              min="0"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-max`} className="block text-sm font-medium text-text-secondary mb-1">
              Giá cao nhất (đ, không bao gồm giá trị này) -- để trống nếu không giới hạn trên
            </label>
            <input
              id={`${formId}-max`}
              name="max_unit_price"
              type="number"
              inputMode="numeric"
              min="0"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Không giới hạn"
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-term`} className="block text-sm font-medium text-text-secondary mb-1">
              Số tháng khấu hao
            </label>
            <input
              id={`${formId}-term`}
              name="term_months"
              type="number"
              inputMode="numeric"
              min="1"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
            />
          </div>
        </form>
      </FormModal>
    </>
  );
}
