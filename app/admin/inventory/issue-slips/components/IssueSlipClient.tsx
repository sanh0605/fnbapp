"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { confirm } from "@/lib/shared/dialog";
import { computeAffectedMonths } from "@/lib/stock/issue-slip-warnings";
import { formatConvertedOnHand } from "@/lib/stock/issue-slip-onhand-display";
import { createIssueSlip, getIssueUnitCostsAt, type IssueSlipItemView } from "../actions";
import { buildIssueUnitOptions, toBaseQuantity, type IssueUnitOption } from "@/lib/stock/issue-unit-options";
import { toSaigonIsoString } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { numberTextToValue } from "@/lib/shared/money-digits";
import { displayMoney } from "@/lib/reports/display-rounding";
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
  const parsedQty = numberTextToValue(rawQty) ?? 0;
  if (!Number.isFinite(parsedQty) || parsedQty <= 0) return "—";
  const baseQty = toBaseQuantity(parsedQty, option);
  const qtyFormatted = formatNumber(baseQty, { withDecimals: !Number.isInteger(baseQty) });
  return `${qtyFormatted} ${item.unitName}`;
}

export function IssueSlipClient({ items }: { items: IssueSlipItemView[] }): JSX.Element {
  const router = useRouter();
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [issuedAtLocal, setIssuedAtLocal] = useState(() => toSaigonIsoString(new Date()).slice(0, 16));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitCosts, setUnitCosts] = useState<Record<string, number>>({});
  const costRequestIdRef = useRef(0);

  useEffect(() => {
    if (!issuedAtLocal) return;
    const d = new Date(issuedAtLocal + ":00+07:00");
    if (Number.isNaN(d.getTime())) return;

    const currentRequestId = ++costRequestIdRef.current;
    getIssueUnitCostsAt(d.toISOString())
      .then(res => {
        if (currentRequestId !== costRequestIdRef.current) return;
        if ("unitCostByItem" in res && res.unitCostByItem) {
          setUnitCosts(res.unitCostByItem);
        } else {
          setUnitCosts({});
        }
      })
      .catch(() => {
        if (currentRequestId !== costRequestIdRef.current) return;
        setUnitCosts({});
      });
  }, [issuedAtLocal]);

  const itemOptions = useMemo(() => items.map(i => ({ id: i.id, label: i.name })), [items]);

  const affectedMonths = useMemo(() => {
    if (!issuedAtLocal) return [];
    const d = new Date(issuedAtLocal + ":00+07:00");
    if (Number.isNaN(d.getTime())) return [];
    return computeAffectedMonths(d);
  }, [issuedAtLocal]);

  const computedLines = useMemo(() => {
    return lines.map(line => {
      const item = items.find(i => i.id === line.purchasedItemId);
      const options = item ? buildIssueUnitOptions(item.unitName, item.packageLines) : [];
      const option = options.find(o => o.key === line.unitKey);
      const parsedQty = numberTextToValue(line.packageQty) ?? 0;
      const isFilled = Boolean(item && option && Number.isFinite(parsedQty) && parsedQty > 0);
      const baseQty = isFilled && option ? toBaseQuantity(parsedQty, option) : null;
      const unitCost = item ? unitCosts[item.id] : undefined;
      const lineValue = (baseQty !== null && typeof unitCost === "number") ? unitCost * baseQty : null;
      const onHandDisplay = getOnHandDisplay(item, line.unitKey, options);
      const convertedDisplay = getConvertedQuantityText(item, line.unitKey, line.packageQty, options);
      const lineValueDisplay = lineValue !== null ? `${formatNumber(displayMoney(lineValue))}đ` : "—";

      return {
        item,
        options,
        option,
        parsedQty,
        isFilled,
        baseQty,
        unitCost,
        lineValue,
        onHandDisplay,
        convertedDisplay,
        lineValueDisplay,
      };
    });
  }, [lines, items, unitCosts]);

  const filledLineCount = computedLines.filter(l => l.isFilled).length;
  const filledLinesWithoutCostCount = computedLines.filter(l => l.isFilled && l.lineValue === null).length;
  const exactTotal = computedLines.reduce((sum, l) => sum + (l.lineValue ?? 0), 0);

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
      const parsedQty = numberTextToValue(line.packageQty) ?? 0;
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
      <div className="hidden md:block">
        <div
          data-testid="form-layout"
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start lg:grid-rows-[auto_1fr]"
        >
          {/* form-shared: slip-wide boxes */}
          <div
            data-testid="form-shared"
            className="bg-surface-card rounded-card border border-border p-4 shadow-sm space-y-3 lg:col-start-3 lg:row-start-1"
          >
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Thời điểm xuất (áp dụng cho cả phiếu)
              </label>
              <SaigonDateTimeInput
                value={issuedAtLocal}
                onChange={setIssuedAtLocal}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
              />
              {affectedMonths.length > 0 && (
                <p className="mt-1.5 text-xs text-warning">
                  Ghi lùi ngày -- sẽ đổi giá vốn của: {affectedMonths.join(", ")}.
                </p>
              )}
            </div>
            <div className="text-sm font-medium text-text-secondary pt-1 border-t border-border">
              Đã điền đủ: {filledLineCount}/{lines.length} dòng
            </div>
          </div>

          {/* form-lines: lines table */}
          <div
            data-testid="form-lines"
            className="lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:row-span-2 space-y-6"
          >
            <Table>
              <TableHead>
                <TableHeaderCell>Mặt hàng</TableHeaderCell>
                <TableHeaderCell>Tồn hiện tại</TableHeaderCell>
                <TableHeaderCell>Đơn vị</TableHeaderCell>
                <TableHeaderCell>Số lượng</TableHeaderCell>
                <TableHeaderCell>Quy ra</TableHeaderCell>
                <TableHeaderCell>Giá trị xuất</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only" aria-label="Xoá dòng">Xoá dòng</span>
                </TableHeaderCell>
              </TableHead>
              <TableBody>
                {lines.map((line, index) => {
                  const computed = computedLines[index];
                  const item = computed?.item;
                  const options = computed?.options ?? [];
                  const onHandDisplay = computed?.onHandDisplay ?? "—";
                  const convertedDisplay = computed?.convertedDisplay ?? "—";
                  const lineValueDisplay = computed?.lineValueDisplay ?? "—";

                  return (
                    <TableRow key={index}>
                      <TableCell>
                        <SearchableSelect
                          value={line.purchasedItemId}
                          onChange={val => handleItemChange(index, val)}
                          options={itemOptions}
                          placeholder="-- Chọn hàng --"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="tabular-nums text-text-secondary">{onHandDisplay}</span>
                      </TableCell>
                      <TableCell>
                        <Select
                          aria-label="Đơn vị"
                          value={line.unitKey}
                          onChange={e => updateLine(index, { unitKey: e.target.value })}
                          disabled={!item}
                        >
                          <option value="">-- Chọn --</option>
                          {options.map(o => (
                            <option key={o.key} value={o.key}>{o.label}</option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell align="right">
                        <NumberInput
                          id={`issue-qty-${index}`}
                          decimals={3}
                          min={0}
                          aria-label="Số lượng"
                          value={line.packageQty === "" ? null : Number(line.packageQty)}
                          onValueChange={v => updateLine(index, { packageQty: v === null ? "" : String(v) })}
                        />
                      </TableCell>
                      <TableCell align="right">
                        {convertedDisplay}
                      </TableCell>
                      <TableCell align="right">
                        {lineValueDisplay}
                      </TableCell>
                      <TableCell>
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(index)}
                            className="text-text-muted hover:text-danger p-2 transition-colors inline-flex items-center justify-center rounded-lg min-h-[44px] md:min-h-[40px] min-w-[44px]"
                            aria-label="Xoá dòng"
                          >
                            ✕
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={7}>
                    <button
                      type="button"
                      onClick={addLine}
                      className="w-full text-center text-primary-active bg-primary-soft/50 border border-dashed border-primary/30 hover:bg-primary-soft hover:border-primary/40 py-3 rounded-xl text-sm font-medium transition min-h-[44px] md:min-h-[40px]"
                    >
                      + Thêm mặt hàng
                    </button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* form-money: totals and action buttons */}
          <div
            data-testid="form-money"
            className="bg-surface-card rounded-card border border-border p-4 shadow-sm space-y-4 lg:col-start-3 lg:row-start-2"
          >
            <div className="flex justify-between items-start">
              <span className="text-sm font-semibold text-text-secondary">Tổng giá trị xuất</span>
              <div className="text-right">
                <span className="text-base font-bold text-text-primary tabular-nums">
                  {formatNumber(displayMoney(exactTotal))}đ
                </span>
                {filledLinesWithoutCostCount > 0 && (
                  <p className="text-xs font-normal text-text-muted mt-0.5">
                    chưa tính {filledLinesWithoutCostCount} dòng chưa có giá
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={submitting}
                className="w-full min-h-[44px] md:min-h-[40px]"
              >
                Ghi phiếu xuất ({lines.length} dòng)
              </Button>
              <Button
                href="/admin/inventory/issue-slips"
                variant="secondary"
                className="w-full"
              >
                Quay lại
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Phone view (below md) */}
      <div className="md:hidden space-y-4">
        {/* Time card first */}
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Thời điểm xuất (áp dụng cho cả phiếu)
            </label>
            <SaigonDateTimeInput
              value={issuedAtLocal}
              onChange={setIssuedAtLocal}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card min-h-[44px] md:min-h-[40px]"
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
            const computed = computedLines[index];
            const item = computed?.item;
            const options = computed?.options ?? [];
            const onHandDisplay = computed?.onHandDisplay ?? "—";
            const convertedDisplay = computed?.convertedDisplay ?? "—";
            const lineValueDisplay = computed?.lineValueDisplay ?? "—";

            return (
              <div key={index} className="p-4 border border-border rounded-xl relative bg-surface-secondary/50">
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="absolute top-2 right-2 text-text-muted hover:text-danger p-2 min-h-[44px] md:min-h-[40px] min-w-[44px] flex items-center justify-center"
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
                    <Select
                      aria-label="Đơn vị"
                      value={line.unitKey}
                      onChange={e => updateLine(index, { unitKey: e.target.value })}
                      disabled={!item}
                    >
                      <option value="">-- Chọn --</option>
                      {options.map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="w-24 shrink-0">
                    <label className="block text-xs font-medium text-text-muted mb-1">Số lượng</label>
                    <NumberInput
                      id={`issue-qty-m-${index}`}
                      decimals={3}
                      min={0}
                      aria-label="Số lượng"
                      value={line.packageQty === "" ? null : Number(line.packageQty)}
                      onValueChange={v => updateLine(index, { packageQty: v === null ? "" : String(v) })}
                    />
                  </div>
                </div>
                <div className="mt-2 text-sm text-text-secondary flex justify-between items-center">
                  <span>Quy ra:</span>
                  <span className="font-medium text-text-primary tabular-nums">{convertedDisplay}</span>
                </div>
                <div className="mt-1.5 text-sm text-text-secondary flex justify-between items-center">
                  <span>Giá trị xuất:</span>
                  <span className="font-medium text-text-primary tabular-nums">{lineValueDisplay}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary card on phone */}
        <div className="bg-surface-card rounded-xl border border-border p-3.5 flex justify-between items-center shadow-sm">
          <span className="text-sm font-semibold text-text-secondary">Tổng giá trị xuất:</span>
          <div className="text-right">
            <span className="text-base font-bold text-text-primary tabular-nums">
              {formatNumber(displayMoney(exactTotal))}đ
            </span>
            {filledLinesWithoutCostCount > 0 && (
              <p className="text-xs text-text-muted mt-0.5">
                chưa tính {filledLinesWithoutCostCount} dòng chưa có giá
              </p>
            )}
          </div>
        </div>

        {/* Add line button */}
        <button
          type="button"
          onClick={addLine}
          className="w-full text-center text-primary-active bg-primary-soft/50 border border-dashed border-primary/30 hover:bg-primary-soft hover:border-primary/40 py-3 rounded-xl text-sm font-medium transition min-h-[44px] md:min-h-[40px]"
        >
          + Thêm mặt hàng
        </button>

        {/* Action buttons */}
        <div className="space-y-3 pt-2">
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={submitting}
            className="w-full min-h-[44px] md:min-h-[40px]"
          >
            Ghi phiếu xuất ({lines.length} dòng)
          </Button>
          <Button
            href="/admin/inventory/issue-slips"
            variant="secondary"
            className="w-full"
          >
            Quay lại
          </Button>
        </div>
      </div>
    </div>
  );
}
