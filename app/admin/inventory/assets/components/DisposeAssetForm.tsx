"use client";

import { useId, useState } from "react";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { formatNumber } from "@/lib/format";
import { disposeAsset, previewDisposalCharge } from "../actions";
import type { AssetView } from "../actions";

// Batch 3, section 5.2: "Đánh dấu hỏng hoặc thanh lý ... Show the amount
// that will be charged this month before confirming." Two steps on one
// screen -- fill quantity/date/reason, see the exact charge, then confirm
// -- rather than a silent write.
export function DisposeAssetForm({ asset }: { asset: AssetView }) {
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [disposedDate, setDisposedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  async function runPreview() {
    setError(null);
    setPreview(null);
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0 || !disposedDate) return;
    setPreviewLoading(true);
    const result = await previewDisposalCharge(asset.id, qty, disposedDate);
    setPreviewLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setPreview(result.charge);
    }
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    formData.set("asset_id", asset.id);
    const res = await disposeAsset(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
      setPreview(null);
    }
  }

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); void runPreview(); }}
        className="text-danger hover:text-danger-active font-medium text-sm min-h-[44px] px-2"
      >
        Đánh dấu hỏng / thanh lý
      </button>

      <FormModal
        isOpen={isOpen}
        onClose={() => { setIsOpen(false); setError(null); setPreview(null); }}
        title={`Thanh lý: ${asset.name}`}
        footer={
          <LoadingButton type="submit" form={`${formId}-dispose-form`} loading={loading} loadingText="Đang lưu...">
            Xác nhận
          </LoadingButton>
        }
      >
        <form id={`${formId}-dispose-form`} action={handleSubmit} className="space-y-4">
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
              onChange={(e) => { setQuantity(e.target.value); void runPreview(); }}
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
              onChange={(e) => { setDisposedDate(e.target.value); void runPreview(); }}
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
        </form>
      </FormModal>
    </>
  );
}
