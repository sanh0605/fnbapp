"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { confirm } from "@/lib/shared/dialog";
import { computeAffectedMonths } from "@/lib/stock/issue-slip-warnings";
import { formatConvertedOnHand } from "@/lib/stock/issue-slip-onhand-display";
import { createIssueSlip, type IssueSlipItemView } from "../actions";
import { buildIssueUnitOptions, toBaseQuantity, type IssueUnitOption } from "@/lib/stock/issue-unit-options";
import { toSaigonIsoString } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { SaigonDateTimeInput } from "@/components/ui/SaigonDateTimeInput";

type DraftLine = {
  purchasedItemId: string;
  unitKey: string;
  packageQty: string;
};

function emptyLine(): DraftLine {
  return { purchasedItemId: "", unitKey: "", packageQty: "" };
}

function getOnHandDisplay(
  item: IssueSlipItemView | undefined,
  unitKey: string,
  options: IssueUnitOption[],
): string {
  if (!item) return "—";
  const selectedPackage = item.packageLines.find(p => p.conversionId === unitKey) || {
    conversionId: unitKey,
    purchasedItemId: item.id,
    purchasedItemName: item.name,
    sizeLabel: "",
    conversionRate: options.find(o => o.key === unitKey)?.factor ?? 1,
    baseUnitName: item.unitName,
    purchasedUnitName: options.find(o => o.key === unitKey)?.unitName ?? item.unitName,
  };
  return formatConvertedOnHand(item.onHand, item.unitName, selectedPackage);
}

function getConvertedQuantityText(
  item: IssueSlipItemView | undefined,
  unitKey: string,
  rawQty: string,
  options: IssueUnitOption[],
): string {
  if (!item) return "—";
  const option = options.find(o => o.key === unitKey);
  if (!option) return "—";
  const parsedQty = Number(rawQty.replace(/[^0-9,]/g, "").replace(",", "."));
  if (!Number.isFinite(parsedQty) || parsedQty <= 0) return "—";
  const baseQty = toBaseQuantity(parsedQty, option);
  const qtyFormatted = formatNumber(baseQty, { withDecimals: !Number.isInteger(baseQty) });
  return `${qtyFormatted} ${item.unitName}`;
}

export function IssueSlipClient({ items }: { items: IssueSlipItemView[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [issuedAtLocal, setIssuedAtLocal] = useState(() => toSaigonIsoString(new Date()).slice(0, 16));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemOptions = useMemo(() => items.map(i => ({ id: i.id, label: i.name })), [items]);

  const affectedMonths = useMemo(() => {
    if (!issuedAtLocal) return [];
    const d = new Date(issuedAtLocal + ":00+07:00");
    if (Number.isNaN(d.getTime())) return [];
    return computeAffectedMonths(d);
  }, [issuedAtLocal]);

  const filledLineCount = lines.filter(line => {
    const item = items.find(i => i.id === line.purchasedItemId);
    if (!item) return false;
    const options = buildIssueUnitOptions(item.unitName, item.packageLines);
    const option = options.find(o => o.key === line.unitKey);
    const parsedQty = Number(line.packageQty.replace(/[^0-9,]/g, "").replace(",", "."));
    return option && Number.isFinite(parsedQty) && parsedQty > 0;
  }).length;

  function addLine() {
    setLines(prev => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines(prev => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines(prev => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function handleItemChange(index: number, purchasedItemId: string) {
    const newItem = items.find(i => i.id === purchasedItemId);
    if (newItem) {
      const options = buildIssueUnitOptions(newItem.unitName, newItem.packageLines);
      updateLine(index, { purchasedItemId, unitKey: options[0]?.key ?? "" });
    } else {
      updateLine(index, { purchasedItemId, unitKey: "" });
    }
  }

  async function handleSubmit() {
    setError(null);

    if (lines.length === 0) {
      setError("Phiếu cần ít nhất một dòng");
      return;
    }

    const payloadLines: Array<{ purchasedItemId: string; baseQuantity: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const item = items.find(it => it.id === line.purchasedItemId);
      if (!item) {
        setError(`Dòng ${i + 1}: chưa chọn mặt hàng`);
        return;
      }
      const options = buildIssueUnitOptions(item.unitName, item.packageLines);
      const option = options.find(o => o.key === line.unitKey);
      if (!option) {
        setError(`Dòng ${i + 1}: chưa chọn quy cách`);
        return;
      }
      const parsedQty = Number(line.packageQty.replace(/[^0-9,]/g, "").replace(",", "."));
      if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
        setError(`Dòng ${i + 1}: số lượng phải lớn hơn 0`);
        return;
      }
      payloadLines.push({ purchasedItemId: item.id, baseQuantity: toBaseQuantity(parsedQty, option) });
    }

    const issuedAt = new Date(issuedAtLocal + ":00+07:00");
    if (Number.isNaN(issuedAt.getTime())) {
      setError("Thời điểm xuất không hợp lệ");
      return;
    }

    if (affectedMonths.length > 0) {
      const approved = await confirm({
        title: "Ghi lùi ngày sẽ đổi số của các tháng đã qua",
        message: `Phiếu xuất này sẽ làm đổi giá vốn của: ${affectedMonths.join(", ")}. Xác nhận vẫn ghi?`,
        variant: "warning",
      });
      if (!approved) return;
    }

    setSubmitting(true);
    const res = await createIssueSlip({
      issuedAtIso: issuedAt.toISOString(),
      note: "",
      lines: payloadLines,
    });
    setSubmitting(false);
    if (res.error || !res.result) {
      setError(res.error || "Không thể ghi phiếu xuất");
      return;
    }
    router.push("/admin/inventory/issue-slips/" + res.result.slipId);
  }

  return (
    <div className="space-y-6">
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Desktop view (md and up) */}
      <div className="hidden md:block space-y-6">
        {/* Top card: Thời điểm xuất (left) & Đã điền đủ (right) */}
        <div className="bg-surface-card rounded-card border border-border p-4 flex flex-row items-center justify-between gap-4 shadow-sm">
          <div>
            <label className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">
              Thời điểm xuất (áp dụng cho cả phiếu)
            </label>
            <SaigonDateTimeInput
              value={issuedAtLocal}
              onChange={setIssuedAtLocal}
              className="w-full max-w-xs border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
            />
            {affectedMonths.length > 0 && (
              <p className="mt-1.5 text-xs text-warning">
                Ghi lùi ngày -- sẽ đổi giá vốn của: {affectedMonths.join(", ")}.
              </p>
            )}
          </div>
          <div className="text-sm font-medium text-text-secondary text-right shrink-0">
            Đã điền đủ: {filledLineCount}/{lines.length} dòng
          </div>
        </div>

        {/* Real Table */}
        <div className="bg-surface-card border border-border rounded-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-secondary text-text-secondary text-xs uppercase tracking-wider">
                  <th className="p-3 font-bold min-w-[240px]">Mặt hàng</th>
                  <th className="p-3 font-bold w-44">Tồn hiện tại</th>
                  <th className="p-3 font-bold w-40">Đơn vị</th>
                  <th className="p-3 font-bold text-right w-28">Số lượng</th>
                  <th className="p-3 font-bold text-right w-36">Quy ra</th>
                  <th className="p-3 w-12 text-center" aria-label="Xoá dòng"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {lines.map((line, index) => {
                  const item = items.find(i => i.id === line.purchasedItemId);
                  const options = item ? buildIssueUnitOptions(item.unitName, item.packageLines) : [];
                  const onHandDisplay = getOnHandDisplay(item, line.unitKey, options);
                  const convertedDisplay = getConvertedQuantityText(item, line.unitKey, line.packageQty, options);

                  return (
                    <tr key={index} className="hover:bg-surface-secondary/40 transition-colors">
                      <td className="p-3 font-medium">
                        <SearchableSelect
                          value={line.purchasedItemId}
                          onChange={val => handleItemChange(index, val)}
                          options={itemOptions}
                          placeholder="-- Chọn hàng --"
                        />
                      </td>
                      <td className="p-3 text-sm text-text-secondary tabular-nums">
                        {onHandDisplay}
                      </td>
                      <td className="p-3">
                        <select
                          aria-label="Đơn vị"
                          value={line.unitKey}
                          onChange={e => updateLine(index, { unitKey: e.target.value })}
                          disabled={!item}
                          className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card disabled:opacity-50"
                        >
                          <option value="">-- Chọn --</option>
                          {options.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label="Số lượng"
                          value={line.packageQty}
                          onChange={e => {
                            const raw = e.target.value.replace(/[^0-9,]/g, "");
                            updateLine(index, { packageQty: raw });
                          }}
                          placeholder="0"
                          className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card disabled:opacity-50"
                        />
                      </td>
                      <td className="p-3 text-right tabular-nums text-text-primary text-sm font-medium">
                        {convertedDisplay}
                      </td>
                      <td className="p-3 text-center">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="text-text-muted hover:text-danger p-2 transition-colors inline-flex items-center justify-center rounded-lg min-h-[44px] min-w-[44px]"
                            aria-label="Xoá dòng"
                          >
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border">
                  <td colSpan={6} className="p-3">
                    <button
                      type="button"
                      onClick={addLine}
                      className="w-full text-center text-primary-active bg-primary-soft/50 border border-dashed border-primary/30 hover:bg-primary-soft hover:border-primary/40 py-3 rounded-xl text-sm font-medium transition min-h-[44px]"
                    >
                      + Thêm mặt hàng
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom action row, right-aligned */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/inventory/issue-slips"
            className="inline-flex items-center justify-center font-medium rounded-button transition-colors bg-surface-secondary text-text-primary hover:bg-border active:bg-border text-sm px-4 py-2 min-h-[44px]"
          >
            Quay lại
          </Link>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            className="min-h-[44px] px-6"
          >
            Ghi phiếu xuất ({lines.length} dòng)
          </Button>
        </div>
      </div>

      {/* Phone view (below md) */}
      <div className="md:hidden space-y-4">
        {/* Time card first */}
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-4 space-y-3">
          <div>
            <label className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">
              Thời điểm xuất (áp dụng cho cả phiếu)
            </label>
            <SaigonDateTimeInput
              value={issuedAtLocal}
              onChange={setIssuedAtLocal}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card min-h-[44px]"
            />
            {affectedMonths.length > 0 && (
              <p className="mt-1.5 text-xs text-warning">
                Ghi lùi ngày -- sẽ đổi giá vốn của: {affectedMonths.join(", ")}.
              </p>
            )}
          </div>
          <p className="text-xs text-text-muted text-center pt-1 border-t border-border">
            Đã điền đủ: {filledLineCount}/{lines.length} dòng
          </p>
        </div>

        {/* Stacked cards per line */}
        <div className="space-y-3">
          {lines.map((line, index) => {
            const item = items.find(i => i.id === line.purchasedItemId);
            const options = item ? buildIssueUnitOptions(item.unitName, item.packageLines) : [];
            const onHandDisplay = getOnHandDisplay(item, line.unitKey, options);
            const convertedDisplay = getConvertedQuantityText(item, line.unitKey, line.packageQty, options);

            return (
              <div key={index} className="p-4 border border-border rounded-xl relative bg-surface-secondary/50">
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="absolute top-2 right-2 text-text-muted hover:text-danger p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                    aria-label="Xoá dòng"
                  >
                    ✕
                  </button>
                )}
                <div className="pr-8">
                  <label className="block text-xs font-medium text-text-muted mb-1">Mặt hàng</label>
                  <SearchableSelect
                    value={line.purchasedItemId}
                    onChange={val => handleItemChange(index, val)}
                    options={itemOptions}
                    placeholder="-- Chọn hàng --"
                  />
                  {item && (
                    <p className="mt-1 text-xs text-text-muted">
                      Tồn hiện tại: {onHandDisplay}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 mt-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-text-muted mb-1">Quy cách</label>
                    <select
                      aria-label="Đơn vị"
                      value={line.unitKey}
                      onChange={e => updateLine(index, { unitKey: e.target.value })}
                      disabled={!item}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card min-h-[44px]"
                    >
                      <option value="">-- Chọn --</option>
                      {options.map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24 shrink-0">
                    <label className="block text-xs font-medium text-text-muted mb-1">Số lượng</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label="Số lượng"
                      value={line.packageQty}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9,]/g, "");
                        updateLine(index, { packageQty: raw });
                      }}
                      placeholder="0"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm text-text-secondary flex justify-between items-center">
                  <span>Quy ra:</span>
                  <span className="font-medium text-text-primary tabular-nums">{convertedDisplay}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add line button */}
        <button
          type="button"
          onClick={addLine}
          className="w-full text-center text-primary-active bg-primary-soft/50 border border-dashed border-primary/30 hover:bg-primary-soft hover:border-primary/40 py-3 rounded-xl text-sm font-medium transition min-h-[44px]"
        >
          + Thêm mặt hàng
        </button>

        {/* Action buttons */}
        <div className="space-y-3 pt-2">
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            className="w-full min-h-[44px]"
          >
            Ghi phiếu xuất ({lines.length} dòng)
          </Button>
          <Link
            href="/admin/inventory/issue-slips"
            className="w-full inline-flex items-center justify-center font-medium rounded-button transition-colors bg-surface-secondary text-text-primary hover:bg-border active:bg-border text-sm px-4 py-2 min-h-[44px]"
          >
            Quay lại
          </Link>
        </div>
      </div>
    </div>
  );
}
