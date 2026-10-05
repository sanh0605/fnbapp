"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { updateAssetBand } from "../actions";
import type { DBAssetDepreciationBand } from "@/types/db";

// Batch 3, section 5.3: "Bảng thời hạn khấu hao" -- the flexible-thing-
// needs-a-screen rule (CLAUDE.md "Viết code"), not a later pass. Phone-first
// and phone-only for this batch (owner 2026-08-17): one card per band, no
// horizontal table, min-h-[44px] tap targets, inputMode="numeric" on every
// number field.
// Wave 4: full-page form instead of modal, returns to detail view on submit/cancel.
export function BandEditForm({
  band,
  returnTo: rawReturnTo,
}: {
  band: DBAssetDepreciationBand;
  returnTo?: string;
}) {
  const returnTo = safeReturnTo(
    rawReturnTo || `/admin/inventory/asset-bands/${band.id}`,
    "/admin/inventory/asset-bands",
  );
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState(String(band.min_unit_price));
  const [maxPrice, setMaxPrice] = useState(band.max_unit_price === null ? "" : String(band.max_unit_price));
  const [termMonths, setTermMonths] = useState(String(band.term_months));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    formData.set("id", band.id);
    const res = await updateAssetBand(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(returnTo);
      router.refresh();
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
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
            loadingText="Đang lưu..."
            className="w-full sm:w-auto min-h-[44px]"
          >
            Lưu
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
