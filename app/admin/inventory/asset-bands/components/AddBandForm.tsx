"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { createAssetBand } from "../actions";

// 2026-08-23, section 2: "A table the owner cannot add a row to is not the
// settings screen CLAUDE.md "Viết code" requires; it is a constant with an
// edit box."
// Wave 4: full-page form instead of modal, returns to list view on submit/cancel.
export function AddBandForm({ returnTo: rawReturnTo }: { returnTo?: string } = {}) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/inventory/asset-bands");
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [termMonths, setTermMonths] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    const res = await createAssetBand(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(returnTo);
      router.refresh();
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
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
