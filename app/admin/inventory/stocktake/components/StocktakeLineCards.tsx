"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { NumberInput } from "@/components/ui/NumberInput";
import { formatNumber } from "@/lib/shared/format";
import { saveStocktakeLine, type StocktakeSessionView } from "../actions";

/**
 * Plan D D6 -- one purchased item, one integer input per ACTIVE package
 * size (lib/stock/stocktake-package-lines.ts, reused from D3, not regenerated
 * here). C6: confirmation happens once per purchased item, not per
 * conversion line and not per ingredient -- a single "Xác nhận" commits
 * every conversion's value as one summed base-unit count.
 */
export function PackageLineCard({
  line,
  disabled = false,
}: {
  line: StocktakeSessionView["lines"][number];
  disabled?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  // Confirmed reflects the SERVER's last saved count, not local input state
  // -- true only immediately after a successful save, and cleared the
  // moment any input changes afterward (C6: editing clears confirmation).
  const [confirmed, setConfirmed] = useState(line.countedQty !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCounted = line.countedQty !== null;
  const variance = isCounted && line.theoreticalAtCount !== null ? line.countedQty! - line.theoreticalAtCount : null;

  function handleInputChange(conversionId: string, raw: string) {
    setValues(prev => ({ ...prev, [conversionId]: raw }));
    setConfirmed(false);
    setError(null);
  }

  async function handleConfirm() {
    // BR-INV-007: only whole sealed packages are counted -- reject a
    // decimal with the reason, rather than rounding it silently.
    let sumBaseQty = 0;
    for (const pkg of line.packageLines) {
      const raw = values[pkg.conversionId];
      if (raw === undefined || raw.trim() === "") continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError(`Số lượng "${pkg.sizeLabel}" không hợp lệ.`);
        return;
      }
      if (!Number.isInteger(parsed)) {
        setError(
          `"${pkg.sizeLabel}": chỉ nhập số nguyên gói còn nguyên seal (quy tắc BR-INV-007) -- không ước lượng phần lẻ.`,
        );
        return;
      }
      sumBaseQty += parsed * pkg.conversionRate;
    }

    setSaving(true);
    setError(null);
    const res = await saveStocktakeLine(line.id, sumBaseQty);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setConfirmed(true);
  }

  return (
    <div className={`bg-surface-card rounded-card shadow-sm border p-4 ${confirmed ? "border-success" : "border-border"}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-medium text-text-primary">{line.itemName}</span>
          <span className="ml-2 text-text-secondary text-xs">Hàng mua vào</span>
        </div>
        {confirmed ? (
          <span className="text-success text-xs font-bold flex items-center gap-1">✓ Đã xác nhận</span>
        ) : isCounted ? (
          <span className="text-warning text-xs font-bold">Đã sửa, chưa xác nhận lại</span>
        ) : (
          <span className="text-text-muted text-xs">Chưa xác nhận</span>
        )}
      </div>

      {/* M1: one package size per row on a phone, not two crammed side by
          side -- "mỗi dòng quy cách một thẻ, xếp dọc". Expands from sm:
          up, where there is room to spare. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {line.packageLines.map(pkg => (
          <label key={pkg.conversionId} className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">{pkg.sizeLabel}</span>
            <NumberInput
              id={`pkg-${pkg.conversionId}`}
              decimals={3}
              min={0}
              example="12"
              aria-label={pkg.sizeLabel}
              disabled={disabled}
              value={(values[pkg.conversionId] ?? "") === "" ? null : Number(values[pkg.conversionId])}
              onValueChange={v => handleInputChange(pkg.conversionId, v === null ? "" : String(v))}
            />
          </label>
        ))}
      </div>

      {error && <div className="text-danger text-xs mb-2">{error}</div>}

      <div className="flex items-center justify-between">
        <div className="text-xs text-text-secondary">
          {isCounted && line.theoreticalAtCount !== null && (
            <>
              Sổ sách: {formatNumber(line.theoreticalAtCount)} {line.unitName}
              {variance !== null && (
                <span className={`ml-2 font-bold ${variance === 0 ? "text-text-secondary" : variance > 0 ? "text-success" : "text-danger"}`}>
                  {variance > 0 ? "+" : ""}{formatNumber(variance)} {line.unitName}
                </span>
              )}
            </>
          )}
        </div>
        {/* M3: this is the button tapped most often in the whole screen --
            one per purchased item, standing at the shelf -- so it gets a
            full 44px thumb target (Button's default md size), not sm's 32px. */}
        <Button variant={confirmed || disabled ? "secondary" : "primary"} onClick={handleConfirm} loading={saving} disabled={disabled}>
          Xác nhận
        </Button>
      </div>
    </div>
  );
}

/**
 * Legacy path, unchanged behaviour: a BASE_INGREDIENT line that survives
 * from a session opened before D4/D6 (C8/C16 -- an already-open session
 * keeps its lines regardless of what a new session would offer). Has no
 * package lines to render, so it keeps the old single base-unit input.
 */
export function LegacyLineCard({
  line,
  disabled = false,
}: {
  line: StocktakeSessionView["lines"][number];
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState(line.countedQty !== null ? String(line.countedQty) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCounted = line.countedQty !== null;
  const variance = isCounted && line.theoreticalAtCount !== null ? line.countedQty! - line.theoreticalAtCount : null;

  async function handleSave() {
    const qty = Number(inputValue);
    if (inputValue === "" || Number.isNaN(qty) || qty < 0) {
      setError("Số đếm không hợp lệ");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await saveStocktakeLine(line.id, qty);
    setSaving(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="bg-surface-card rounded-card shadow-sm border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="font-medium text-text-primary">{line.itemName}</span>
          <span className="ml-2 text-text-secondary text-xs">
            {line.itemType === "SEMI_PRODUCT" ? "Bán thành phẩm" : "Nguyên liệu"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {error && <span className="text-danger text-xs">{error}</span>}
          <div className="w-32">
            <NumberInput
              id={`legacy-qty-${line.id}`}
              decimals={3}
              min={0}
              example="1,250.5"
              aria-label={`Số đếm ${line.itemName}`}
              disabled={disabled}
              value={inputValue === "" ? null : Number(inputValue)}
              onValueChange={v => setInputValue(v === null ? "" : String(v))}
            />
          </div>
          <span className="text-text-muted text-xs">{line.unitName}</span>
          <Button variant="secondary" onClick={handleSave} loading={saving} disabled={disabled}>
            Lưu
          </Button>
        </div>
      </div>
      <div className="mt-2 text-xs text-text-secondary">
        {isCounted ? (
          <>
            Sổ sách: {formatNumber(line.theoreticalAtCount)} {line.unitName}
            {variance !== null && (
              <span className={`ml-2 font-bold ${variance === 0 ? "text-text-secondary" : variance > 0 ? "text-success" : "text-danger"}`}>
                {variance > 0 ? "+" : ""}{formatNumber(variance)} {line.unitName}
              </span>
            )}
          </>
        ) : "---"}
      </div>
    </div>
  );
}
