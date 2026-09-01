"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { updateAssetBand } from "../actions";
import type { DBAssetDepreciationBand } from "@/types/db";

// Batch 3, section 5.3: "Bảng thời hạn khấu hao" -- the flexible-thing-
// needs-a-screen rule (CLAUDE.md section 8), not a later pass. Phone-first
// and phone-only for this batch (owner 2026-08-17): one card per band, no
// horizontal table, min-h-[44px] tap targets, inputMode="numeric" on every
// number field.
export function BandEditForm({ band }: { band: DBAssetDepreciationBand }) {
  const formId = useId();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState(String(band.min_unit_price));
  const [maxPrice, setMaxPrice] = useState(band.max_unit_price === null ? "" : String(band.max_unit_price));
  const [termMonths, setTermMonths] = useState(String(band.term_months));

  // docs/superpowers/plans/2026-09-01-two-defects-the-owner-found-testing.md
  // section B: revalidatePath (in updateAssetBand) marks the server cache
  // stale but does not repaint this already-open page.
  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    formData.set("id", band.id);
    const res = await updateAssetBand(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-primary hover:text-primary-hover font-medium text-sm min-h-[44px] px-2"
      >
        Sửa
      </button>

      <FormModal
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); setError(null); }}
        title="Sửa khung khấu hao"
        footer={
          <LoadingButton type="submit" form={`${formId}-band-form`} loading={loading} loadingText="Đang lưu...">
            Lưu
          </LoadingButton>
        }
      >
        <form id={`${formId}-band-form`} action={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
              {error}
            </div>
          )}
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
          <p className="text-xs text-text-muted">
            Sửa khung chỉ áp dụng cho tài sản mua sau khi lưu -- tài sản đã có giữ nguyên số tháng đã tính lúc mua.
          </p>
        </form>
      </FormModal>
    </>
  );
}
