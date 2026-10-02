"use client";

import { useId, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { formatNumber } from "@/lib/shared/format";
import { toSaigonIsoString } from "@/lib/shared/datetime";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { disposeAsset, previewDisposalCharge } from "../actions";
import type { AssetView } from "../actions";

// Batch 3, section 5.2: "Đánh dấu hỏng hoặc thanh lý ... Show the amount
// that will be charged this month before confirming."
// Wave 4: full-page form instead of modal, returns to list view on submit/cancel.
export function DisposeAssetForm({
  asset,
  returnTo: rawReturnTo,
}: {
  asset: AssetView;
  returnTo?: string;
}) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/inventory/assets");
  const formId = useId();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  // 2026-08-27 fix (OPEN-ITEMS 64): new Date().toISOString() is UTC, this
  // browser's clock -- sliced directly, a disposal recorded between 00:00
  // and 07:00 Saigon defaulted to the previous day, silently. The shop is
  // in Saigon; every other date in the system already means Saigon.
  const [disposedDate, setDisposedDate] = useState(() => toSaigonIsoString(new Date()).slice(0, 10));
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function runPreview() {
      setError(null);
      setPreview(null);
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0 || !disposedDate) return;
      setPreviewLoading(true);
      const result = await previewDisposalCharge(asset.id, qty, disposedDate);
      if (cancelled) return;
      setPreviewLoading(false);
      if ("error" in result) {
        setError(result.error);
      } else {
        setPreview(result.charge);
      }
    }
    void runPreview();
    return () => {
      cancelled = true;
    };
  }, [asset.id, quantity, disposedDate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    formData.set("asset_id", asset.id);
    const res = await disposeAsset(formData);
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
        <p className="text-sm text-text-secondary">Còn lại: <strong>{asset.remainingQuantity}</strong> cái</p>
        <div>
          <label htmlFor={`${formId}-quantity`} className="block text-sm font-medium text-text-secondary mb-1">
            Số lượng thanh lý
          </label>
          <input
            id={`${formId}-quantity`}
            name="quantity"
            type="number"
            inputMode="numeric"
            min="1"
            max={asset.remainingQuantity}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-date`} className="block text-sm font-medium text-text-secondary mb-1">
            Ngày thanh lý
          </label>
          <input
            id={`${formId}-date`}
            name="disposed_date"
            type="date"
            value={disposedDate}
            onChange={(e) => setDisposedDate(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-reason`} className="block text-sm font-medium text-text-secondary mb-1">
            Lý do
          </label>
          <input
            id={`${formId}-reason`}
            name="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Vỡ, hỏng, mất"
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
          />
        </div>

        <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
          <div className="text-[10px] font-bold text-warning-active uppercase tracking-wider mb-1">
            Sẽ ghi nhận chi phí tháng này
          </div>
          <div className="text-lg font-bold text-warning-active">
            {previewLoading ? "Đang tính..." : preview !== null ? `${formatNumber(preview)}đ` : "---"}
          </div>
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
            Xác nhận
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
