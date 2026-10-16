"use client";

import { useId, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { NumberInput } from "@/components/ui/NumberInput";
import { DayInput } from "@/components/ui/DayInput";
import { TextInput } from "@/components/ui/TextInput";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { formatNumber } from "@/lib/shared/format";
import { toSaigonIsoString, formatDateTimeFull } from "@/lib/shared/datetime";
import { safeReturnTo } from "@/lib/shared/return-to";
import { disposeAsset, previewDisposalCharge } from "../actions";
import type { AssetLotView } from "@/lib/assets/asset-items";

export interface DisposeAssetFormProps {
  lots: AssetLotView[];
  initialLotId?: string;
  returnTo?: string;
  // ACTIVE bank accounts for "Chuyển khoản" (BR-COGS-008); the inputs are drawn by ticket B.
  bankAccounts?: { id: string; name: string }[];
}

export function DisposeAssetForm({
  lots,
  initialLotId,
  returnTo: rawReturnTo,
  bankAccounts = [],
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
  const [proceedsError, setProceedsError] = useState("");
  const [quantity, setQuantity] = useState("");
  const [proceeds, setProceeds] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
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
    if (proceeds === "") {
      setProceedsError("Nhập số tiền thu được, bỏ đi thì nhập 0");
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

  const isProceedsPositive = Number(proceeds) > 0;
  const hasNoBankAccounts = bankAccounts.length === 0;

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
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
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition min-h-[48px] md:min-h-[40px] ${
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
                      Mua {formatDateTimeFull(lot.acquiredDate)} · giá một cái {formatNumber(Math.round(lot.unitCost))}đ · còn {lot.remainingQuantity}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-sm text-text-secondary">
            Mua {formatDateTimeFull(selectedLot.acquiredDate)} · giá một cái {formatNumber(Math.round(selectedLot.unitCost))}đ · còn {selectedLot.remainingQuantity}
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

        <Field label="Số tiền thu được" htmlFor={`${formId}-proceeds`}>
          <NumberInput
            id={`${formId}-proceeds`}
            name="proceeds"
            decimals={0}
            min={0}
            example="150,000"
            hint="Bán lại được bao nhiêu thì nhập bấy nhiêu; bỏ đi thì nhập 0."
            error={proceedsError}
            value={proceeds === "" ? null : Number(proceeds)}
            onValueChange={(v) => {
              setProceeds(v === null ? "" : String(v));
              setProceedsError("");
            }}
          />
        </Field>

        {isProceedsPositive && (
          <Field
            label="Nhận vào"
            htmlFor={`${formId}-payment_method`}
            hint={hasNoBankAccounts ? "Chưa có tài khoản ngân hàng" : undefined}
          >
            <Select
              id={`${formId}-payment_method`}
              name="payment_method"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(
                  e.target.value === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH"
                )
              }
            >
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER" disabled={hasNoBankAccounts}>
                Chuyển khoản
              </option>
            </Select>
          </Field>
        )}

        {isProceedsPositive && paymentMethod === "BANK_TRANSFER" && (
          <Field label="Tài khoản" htmlFor={`${formId}-bank_account_id`} required>
            <Select
              id={`${formId}-bank_account_id`}
              name="bank_account_id"
              required
              defaultValue=""
            >
              <option value="" disabled>Chọn tài khoản</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

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

        <FormActionBar
          mode="create"
          loading={loading}
          onCancel={() => router.push(returnTo)}
        />
      </form>
    </div>
  );
}
