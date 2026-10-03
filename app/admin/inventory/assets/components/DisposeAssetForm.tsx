"use client";

import { useId, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { formatNumber } from "@/lib/shared/format";
import { toSaigonIsoString } from "@/lib/shared/datetime";
import { safeReturnTo } from "@/app/admin/inventory/components/return-to";
import { disposeAsset, previewDisposalCharge } from "../actions";
import type { AssetLotView } from "@/lib/assets/asset-items";

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return y && m && d ? `${d}/${m}/${y}` : dateStr;
}

export interface DisposeAssetFormProps {
  lots: AssetLotView[];
  initialLotId?: string;
  returnTo?: string;
}

export function DisposeAssetForm({
  lots,
  initialLotId,
  returnTo: rawReturnTo,
}: DisposeAssetFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/inventory/assets");
  const formId = useId();
  const router = useRouter();

  const [selectedLotId, setSelectedLotId] = useState<string>(
    () => initialLotId ?? lots[0]?.id ?? "",
  );
  const selectedLot = lots.find((l) => l.id === selectedLotId) ?? lots[0];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [disposedDate, setDisposedDate] = useState(() =>
    toSaigonIsoString(new Date()).slice(0, 10),
  );
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function runPreview() {
      if (!selectedLot) return;
      setError(null);
      setPreview(null);
      const qty = Number(quantity);
      if (!Number.isFinite(qty) || qty <= 0 || !disposedDate) return;
      setPreviewLoading(true);
      const result = await previewDisposalCharge(selectedLot.id, qty, disposedDate);
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
  }, [selectedLot?.id, quantity, disposedDate]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedLot) return;
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    formData.set("asset_id", selectedLot.id);
    const res = await disposeAsset(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      router.push(returnTo);
      router.refresh();
    }
  }

  if (!selectedLot) {
    return null;
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20"
          >
            {error}
          </div>
        )}

        {/* Lot selection */}
        {lots.length > 1 ? (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Chọn lần mua
            </label>
            <div className="space-y-2">
              {lots.map((lot) => {
                const isSelected = lot.id === selectedLot.id;
                return (
                  <label
                    key={lot.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition min-h-[44px] ${
                      isSelected
                        ? "border-primary bg-primary-soft/30 text-text-primary"
                        : "border-border bg-surface-card hover:bg-surface-secondary/50 text-text-secondary"
                    }`}
                  >
                    <input
                      type="radio"
                      name="lot_id"
                      value={lot.id}
                      checked={isSelected}
                      onChange={() => {
                        setSelectedLotId(lot.id);
                        if (Number(quantity) > lot.remainingQuantity) {
                          setQuantity(String(lot.remainingQuantity));
                        }
                      }}
                      className="w-4 h-4 text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="text-sm font-medium">
                      Mua {formatDate(lot.acquiredDate)} · giá một cái {formatNumber(Math.round(lot.unitCost))}đ · còn {lot.remainingQuantity}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-sm text-text-secondary">
            Mua {formatDate(selectedLot.acquiredDate)} · giá một cái {formatNumber(Math.round(selectedLot.unitCost))}đ · còn {selectedLot.remainingQuantity}
          </div>
        )}

        <p className="text-sm text-text-secondary">
          Còn lại: <strong>{selectedLot.remainingQuantity}</strong> cái
        </p>

        <div>
          <label
            htmlFor={`${formId}-quantity`}
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Số lượng thanh lý
          </label>
          <input
            id={`${formId}-quantity`}
            name="quantity"
            type="number"
            inputMode="numeric"
            min="1"
            max={selectedLot.remainingQuantity}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card min-h-[44px]"
          />
        </div>

        <div>
          <label
            htmlFor={`${formId}-date`}
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Ngày thanh lý
          </label>
          <input
            id={`${formId}-date`}
            name="disposed_date"
            type="date"
            value={disposedDate}
            onChange={(e) => setDisposedDate(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card min-h-[44px]"
          />
        </div>

        <div>
          <label
            htmlFor={`${formId}-reason`}
            className="block text-sm font-medium text-text-secondary mb-1"
          >
            Lý do
          </label>
          <input
            id={`${formId}-reason`}
            name="reason"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="VD: Vỡ, hỏng, mất"
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card min-h-[44px]"
          />
        </div>

        <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
          <div className="text-[10px] font-bold text-warning-active uppercase tracking-wider mb-1">
            Sẽ ghi nhận chi phí tháng này
          </div>
          <div className="text-lg font-bold text-warning-active">
            {previewLoading
              ? "Đang tính..."
              : preview !== null
              ? `${formatNumber(preview)}đ`
              : "---"}
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
