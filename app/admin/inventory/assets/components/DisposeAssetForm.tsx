"use client";

import { useId, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { NumberInput } from "@/components/ui/NumberInput";
import { DayInput } from "@/components/ui/DayInput";
import { TextInput } from "@/components/ui/TextInput";
import { Field } from "@/components/ui/Field";
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
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [dateError, setDateError] = useState("");
  const [quantityError, setQuantityError] = useState("");
  const [quantity, setQuantity] = useState("");
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
      if (
        !Number.isFinite(qty) ||
        qty <= 0 ||
        !disposedDate ||
        disposedDate === "invalid"
      ) {
        return;
      }
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
    if (savingRef.current) return;
    if (!selectedLot) return;
    if (quantity === "") {
      setQuantityError("Cần nhập số.");
      return;
    }
    if (!disposedDate || disposedDate === "invalid") {
      setDateError("Ngày không hợp lệ");
      return;
    }
    const formData = new FormData(e.currentTarget);
    savingRef.current = true;
    setLoading(true);
    setError(null);
    formData.set("asset_id", selectedLot.id);
    try {
      const res = await disposeAsset(formData);
      if (res.error) {
        savingRef.current = false;
        setLoading(false);
        setError(res.error);
      } else {
        router.push(returnTo);
        router.refresh();
      }
    } catch {
      savingRef.current = false;
      setLoading(false);
      setError("Không lưu được. Kiểm tra mạng rồi bấm lại.");
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
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition min-h-[44px] md:min-h-[40px] ${
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
                        if (quantity !== "" && Number(quantity) > lot.remainingQuantity) {
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

        <Field label="Số lượng thanh lý" htmlFor={`${formId}-quantity`}>
          <NumberInput
            id={`${formId}-quantity`}
            name="quantity"
            decimals={0}
            min={1}
            max={selectedLot.remainingQuantity}
            example="1"
            error={quantityError}
            value={quantity === "" ? null : Number(quantity)}
            onValueChange={(v) => {
              setQuantity(v === null ? "" : String(v));
              setQuantityError("");
            }}
          />
        </Field>

        <div>
          <DayInput
            label="Ngày thanh lý"
            value={disposedDate}
            onChange={(val) => {
              setDisposedDate(val);
              setDateError("");
            }}
            error={dateError}
          />
          <input type="hidden" name="disposed_date" value={disposedDate} />
        </div>

        <Field
          label="Lý do"
          htmlFor={`${formId}-reason`}
        >
          <TextInput
            id={`${formId}-reason`}
            name="reason"
            type="text"
            example="Vỡ, hỏng, mất"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>

        <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
          <div className="text-xs text-warning-active mb-1">
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
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto"
          >
            Bỏ
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Đang lưu..." : "Xác nhận"}
          </Button>
        </div>
      </form>
    </div>
  );
}
