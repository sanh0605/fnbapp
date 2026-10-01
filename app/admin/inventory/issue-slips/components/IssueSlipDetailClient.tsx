"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { formatNumber } from "@/lib/shared/format";
import type { IssueSlipDetail } from "@/lib/stock/issue-slip-detail";
import type { IssueSlipItemView } from "../actions";
import { editIssueSlip, cancelIssueSlip } from "../actions";
import { initialUnitQuantity, toBaseQuantity, LOOSE_UNIT_KEY } from "@/lib/stock/issue-unit-options";
import type { EditDraftLine } from "@/lib/stock/issue-slip-edit-diff";
import { Alert } from "@/components/ui/Alert";
import { buildIssueUnitOptions } from "@/lib/stock/issue-unit-options";
import { BackLink } from "@/components/ui/BackLink";

interface IssueSlipDetailClientProps {
  detail: IssueSlipDetail;
  items: IssueSlipItemView[];
}

interface DraftLine {
  id: string; // Internal id for React key
  issueId: string | null; // null if new
  purchasedItemId: string;
  name: string;
  unitKey: string; // The selected unit's key
  quantityInput: string; // The raw input string
  baseQuantity: number; // The computed base quantity
  removed: boolean; // Marked for deletion
  selected: boolean; // Selected in the table checkbox
}

function parseInputQuantity(val: string): number {
  const raw = val.replace(/[^0-9,]/g, "");
  return Number(raw.replace(",", ".")) || 0;
}

function formatInputQuantity(val: number): string {
  return String(Math.round(val * 1000) / 1000).replace(".", ",");
}

export default function IssueSlipDetailClient({ detail, items }: IssueSlipDetailClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<DraftLine[]>([]);
  const [dialog, setDialog] = useState<"cancel" | "empty" | null>(null);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [nextNewId, setNextNewId] = useState(1);

  const itemOptions = items.map((i) => ({ id: i.id, label: i.name }));

  function startEdit() {
    const initialDraft: DraftLine[] = detail.lines.map((line) => {
      const initUnit = initialUnitQuantity(line.baseQuantity, line.unitOptions);
      return {
        id: `OLD-${line.issueId}`,
        issueId: line.issueId,
        purchasedItemId: line.purchasedItemId,
        name: line.name,
        unitKey: initUnit.key,
        quantityInput: formatInputQuantity(initUnit.quantity),
        baseQuantity: line.baseQuantity,
        removed: false,
        selected: false,
      };
    });
    setDraft(initialDraft);
    setMode("edit");
    setServerError(null);
  }

  function discard() {
    setMode("view");
    setDraft([]);
    setServerError(null);
  }

  function updateLine(id: string, patch: Partial<DraftLine>) {
    setDraft((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );
  }

  function toggleAll() {
    const visibleLines = draft.filter((l) => !l.removed);
    const allSelected = visibleLines.length > 0 && visibleLines.every((l) => l.selected);
    setDraft((prev) =>
      prev.map((l) => (!l.removed ? { ...l, selected: !allSelected } : l))
    );
  }

  function deleteSelected() {
    const next = draft.map((l) =>
      l.selected ? { ...l, removed: true, selected: false } : l
    );
    setDraft(next);
    if (next.filter((l) => !l.removed && (l.issueId !== null || l.purchasedItemId)).length === 0) {
      setDialog("empty");
    }
  }

  function addLine() {
    const id = `NEW-${nextNewId}`;
    setNextNewId((prev) => prev + 1);
    setDraft((prev) => [
      ...prev,
      {
        id,
        issueId: null,
        purchasedItemId: "",
        name: "",
        unitKey: "",
        quantityInput: "",
        baseQuantity: 0,
        removed: false,
        selected: false,
      },
    ]);
  }

  function handleItemChange(id: string, purchasedItemId: string) {
    const item = items.find((i) => i.id === purchasedItemId);
    if (!item) {
      updateLine(id, {
        purchasedItemId: "",
        name: "",
        unitKey: "",
        quantityInput: "",
        baseQuantity: 0,
      });
      return;
    }
    const unitOptions = buildIssueUnitOptions(item.unitName, item.packageLines);
    const firstOption = unitOptions[0];
    updateLine(id, {
      purchasedItemId: item.id,
      name: item.name,
      unitKey: firstOption.key,
      quantityInput: "1",
      baseQuantity: firstOption.factor, // 1 * factor
    });
  }

  function handleUnitChange(id: string, unitKey: string) {
    setDraft((prev) => {
      const line = prev.find((l) => l.id === id);
      if (!line) return prev;
      let unitOptions = detail.lines.find((l) => l.issueId === line.issueId)?.unitOptions;
      if (!unitOptions) {
        const item = items.find((i) => i.id === line.purchasedItemId);
        if (item) {
          unitOptions = buildIssueUnitOptions(item.unitName, item.packageLines);
        }
      }
      if (!unitOptions) return prev;
      const option = unitOptions.find((o) => o.key === unitKey);
      if (!option) return prev;

      // When changing unit, we keep the underlying baseQuantity and adjust the input
      const newQty = line.baseQuantity / option.factor;
      return prev.map((l) =>
        l.id === id
          ? {
              ...l,
              unitKey,
              quantityInput: formatInputQuantity(newQty),
            }
          : l
      );
    });
  }

  function handleQtyChange(id: string, val: string) {
    const raw = val.replace(/[^0-9,]/g, "");
    setDraft((prev) => {
      const line = prev.find((l) => l.id === id);
      if (!line) return prev;
      let unitOptions = detail.lines.find((l) => l.issueId === line.issueId)?.unitOptions;
      if (!unitOptions) {
        const item = items.find((i) => i.id === line.purchasedItemId);
        if (item) {
          unitOptions = buildIssueUnitOptions(item.unitName, item.packageLines);
        }
      }
      const option = unitOptions?.find((o) => o.key === line.unitKey);
      const factor = option ? option.factor : 1;
      const parsedQty = Number(raw.replace(",", ".")) || 0;
      
      return prev.map((l) =>
        l.id === id
          ? {
              ...l,
              quantityInput: raw,
              baseQuantity: toBaseQuantity(parsedQty, option || { key: "", label: "", factor: 1, unitName: "" }),
            }
          : l
      );
    });
  }

  async function save() {
    const activeLines = draft.filter((l) => !l.removed && (l.issueId !== null || l.purchasedItemId));
    if (activeLines.length === 0) {
      setDialog("empty");
      return;
    }

    const payload: EditDraftLine[] = draft.map((l) => ({
      issueId: l.issueId,
      purchasedItemId: l.purchasedItemId,
      baseQuantity: l.baseQuantity,
      removed: l.removed,
    }));

    setServerError(null);
    startTransition(async () => {
      const res = await editIssueSlip({ slipId: detail.id, draft: payload });
      if (res.error) {
        setServerError(res.error);
      } else {
        router.refresh();
        setMode("view");
        setDraft([]);
      }
    });
  }

  async function handleConfirmCancel() {
    if (!reason.trim()) return;
    setServerError(null);
    startTransition(async () => {
      const res = await cancelIssueSlip({ slipId: detail.id, reason: reason.trim() });
      if (res.error) {
        setServerError(res.error);
        setDialog(null);
      } else {
        router.refresh();
        setDialog(null);
        setMode("view");
        setDraft([]);
      }
    });
  }

  // Derived state
  const visibleLines = draft.filter((l) => !l.removed);
  const selectedCount = visibleLines.filter((l) => l.selected).length;
  const allSelected = visibleLines.length > 0 && selectedCount === visibleLines.length;

  let changed = false;
  let exactDraftSum = 0;
  if (mode === "edit") {
    const realDraft = draft.filter((l) => l.issueId !== null || l.purchasedItemId);
    const originalMap = new Map(detail.lines.map((l) => [l.issueId, l.baseQuantity]));
    
    for (const d of realDraft) {
      if (d.issueId !== null) {
        if (d.removed || originalMap.get(d.issueId) !== d.baseQuantity) {
          changed = true;
        }
      } else if (!d.removed) {
        changed = true;
      }
      
      if (!d.removed && d.purchasedItemId) {
        const unitCost = detail.unitCostByItem?.[d.purchasedItemId];
        if (unitCost !== undefined) {
          exactDraftSum += unitCost * d.baseQuantity;
        }
      }
    }
  }
  const draftTotalValue = Math.round(exactDraftSum);

  const saveDisabled = visibleLines.filter((l) => l.issueId !== null || l.purchasedItemId).length === 0 || !changed;

  return (
    <div className="space-y-6 flex flex-col h-full bg-surface-background">
      <BackLink href="/admin/inventory/issue-slips" label="Phiếu xuất" />

      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="m-0 text-2xl font-bold text-text-primary">{detail.id}</h1>
            {detail.cancellation && (
              <span className="px-3 py-1 rounded-full bg-surface-secondary text-text-secondary text-xs font-bold border border-border">
                Đã huỷ
              </span>
            )}
            {mode === "edit" && (
              <span className="px-3 py-1 rounded-full bg-warning/20 text-warning-active text-xs font-bold">
                Đang chỉnh sửa
              </span>
            )}
          </div>
          <div className="flex gap-6 text-sm text-text-secondary">
            <span>Ngày xuất: <b className="text-text-primary">{detail.dateText}</b></span>
            <span>Người ghi: <b className="text-text-primary">{detail.createdByName}</b></span>
            {detail.note?.trim() ? (
              <span>Lý do: <b className="text-text-primary">{detail.note.trim()}</b></span>
            ) : null}
          </div>
          {detail.cancellation && detail.cancellation.reason && (
            <div className="text-sm text-text-secondary">
              Lý do huỷ: <b className="text-text-primary">{detail.cancellation.reason}</b>
            </div>
          )}
          {detail.cancellation && (
            <div className="text-sm text-text-secondary">
              Huỷ lúc {detail.cancellation.dateText}
            </div>
          )}
        </div>
        {mode === "view" && detail.canEdit && !detail.cancellation && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={startEdit} className="border-primary text-primary hover:bg-primary-soft">
              Chỉnh sửa
            </Button>
            <Button variant="secondary" onClick={() => { setDialog("cancel"); setReason(""); }} className="border-danger text-danger hover:bg-danger/10">
              Huỷ phiếu
            </Button>
          </div>
        )}
      </div>

      {serverError && <Alert variant="danger">{serverError}</Alert>}

      {detail.lock && (
        <div className="flex gap-2.5 items-start max-w-lg p-3 rounded-lg bg-warning/10 text-warning-active text-sm leading-relaxed">
          <span>Phiếu nằm trước lần kiểm kê ngày {detail.lock.dateText} nên không sửa được. Sai lệch sẽ được bù ở lần kiểm kê sau.</span>
        </div>
      )}

      {mode === "view" && (
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          {/* Desktop view */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-surface-secondary text-text-secondary text-xs uppercase tracking-wider">
                  <th className="p-3 font-bold w-12 text-center">#</th>
                  <th className="p-3 font-bold">Mặt hàng</th>
                  <th className="p-3 font-bold text-right">Số lượng</th>
                  <th className="p-3 font-bold text-right">Giá trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {detail.lines.map((l, i) => (
                  <tr key={l.issueId} className="hover:bg-surface-secondary/50">
                    <td className="p-3 text-text-muted text-center">{i + 1}</td>
                    <td className="p-3 font-medium text-text-primary">{l.name}</td>
                    <td className="p-3 text-right tabular-nums text-text-primary">{l.quantityText}</td>
                    <td className="p-3 text-right tabular-nums text-text-primary">{formatNumber(l.value)}đ</td>
                  </tr>
                ))}
                <tr className="bg-surface-secondary/30">
                  <td className="p-3"></td>
                  <td className="p-3 font-bold text-text-primary" colSpan={2}>Tổng giá trị</td>
                  <td className="p-3 text-right font-bold tabular-nums text-text-primary">{formatNumber(detail.totalValue)}đ</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile view */}
          <div className="md:hidden flex flex-col divide-y divide-border">
            {detail.lines.map((l, i) => (
              <div key={l.issueId} className="p-4 flex justify-between gap-3 bg-surface-card">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-text-primary text-sm">{l.name}</span>
                  <span className="text-xs text-text-secondary">{l.quantityText}</span>
                </div>
                <span className="font-semibold text-sm tabular-nums whitespace-nowrap text-text-primary">{formatNumber(l.value)}đ</span>
              </div>
            ))}
            <div className="p-4 flex justify-between font-bold text-sm bg-surface-secondary/30">
              <span className="text-text-primary">Tổng giá trị</span>
              <span className="text-text-primary">{formatNumber(detail.totalValue)}đ</span>
            </div>
          </div>
        </div>
      )}

      {mode === "edit" && (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-text-secondary">
            Đổi số lượng: tính vào ngày của phiếu. Xoá dòng: trả hàng về kho vào ngày bấm lưu. Dòng mới: tính vào ngày của phiếu.
          </div>

          {/* Desktop view */}
          <div className="hidden md:block bg-surface-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-surface-secondary text-text-secondary text-xs uppercase tracking-wider">
                  <th className="p-2 w-12 text-center">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-border"
                    />
                  </th>
                  <th className="p-2 font-bold min-w-[200px]">Mặt hàng</th>
                  <th className="p-2 font-bold w-40">Đơn vị</th>
                  <th className="p-2 font-bold text-right w-32">Số lượng</th>
                  <th className="p-2 font-bold text-right w-36">Quy ra</th>
                  <th className="p-2 font-bold text-right w-32">Giá trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {draft.map((l) => {
                  let unitOptions = detail.lines.find((ol) => ol.issueId === l.issueId)?.unitOptions;
                  let baseUnitName = "";
                  if (!unitOptions && l.purchasedItemId) {
                    const item = items.find((i) => i.id === l.purchasedItemId);
                    if (item) {
                      unitOptions = buildIssueUnitOptions(item.unitName, item.packageLines);
                      baseUnitName = item.unitName;
                    }
                  } else if (l.issueId) {
                    baseUnitName = detail.lines.find((ol) => ol.issueId === l.issueId)?.baseUnitName || "";
                  }

                  const qtyValue = l.baseQuantity;
                  const qtyText = formatNumber(qtyValue, { withDecimals: !Number.isInteger(qtyValue) });

                  return (
                    <tr key={l.id} className={`hover:bg-surface-secondary/50 ${l.selected ? "bg-danger/5" : ""} ${l.removed ? "opacity-50" : ""}`}>
                      <td className="p-2 text-center">
                        <input
                          type="checkbox"
                          aria-label="Chọn dòng"
                          checked={l.selected}
                          disabled={l.removed}
                          onChange={() => updateLine(l.id, { selected: !l.selected })}
                          className="w-4 h-4 rounded border-border"
                        />
                      </td>
                      <td className="p-2 font-medium">
                        {l.issueId ? (
                          <span className={`text-text-primary ${l.removed ? "line-through" : ""}`}>{l.name}</span>
                        ) : (
                          <SearchableSelect
                            value={l.purchasedItemId}
                            onChange={(val) => handleItemChange(l.id, val)}
                            options={itemOptions}
                            placeholder="Chọn mặt hàng..."
                          />
                        )}
                      </td>
                      <td className="p-2">
                        <select
                          aria-label="Đơn vị"
                          value={l.unitKey}
                          onChange={(e) => handleUnitChange(l.id, e.target.value)}
                          disabled={!l.purchasedItemId || l.removed}
                          className="w-full border border-border rounded-lg px-2 py-1.5 text-sm outline-none bg-surface-card disabled:opacity-50"
                        >
                          {unitOptions ? (
                            unitOptions.map((o) => (
                              <option key={o.key} value={o.key}>{o.label}</option>
                            ))
                          ) : (
                            <option value="">—</option>
                          )}
                        </select>
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label="Số lượng"
                          value={l.quantityInput}
                          onChange={(e) => handleQtyChange(l.id, e.target.value)}
                          disabled={!l.purchasedItemId || l.removed}
                          className="w-full border border-border rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card disabled:opacity-50"
                        />
                      </td>
                      <td className="p-2 text-right tabular-nums text-text-primary">
                        {l.purchasedItemId ? `${qtyText} ${baseUnitName}` : "—"}
                      </td>
                      <td className="p-2 text-right tabular-nums text-text-primary">
                        {(() => {
                          if (!l.purchasedItemId) return "—";
                          const unitCost = detail.unitCostByItem?.[l.purchasedItemId];
                          if (unitCost === undefined) return "—";
                          const exactValue = unitCost * l.baseQuantity;
                          const formattedValue = formatNumber(Math.round(exactValue)) + "đ";
                          
                          if (l.removed) {
                            const oldLine = detail.lines.find(ol => ol.issueId === l.issueId);
                            if (oldLine) {
                              return <span className="line-through text-text-muted">{formatNumber(oldLine.value)}đ</span>;
                            }
                            return <span className="line-through text-text-muted">{formattedValue}</span>;
                          }
                          return formattedValue;
                        })()}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border">
                  <td colSpan={6} className="p-0">
                    <button
                      type="button"
                      onClick={addLine}
                      className="w-full h-12 px-4 border-0 bg-transparent text-primary font-bold text-sm text-left cursor-pointer hover:bg-surface-secondary/50"
                    >
                      + Thêm dòng
                    </button>
                  </td>
                </tr>
                <tr className="bg-surface-secondary/30">
                  <td className="p-2"></td>
                  <td className="p-2 font-bold text-text-primary" colSpan={4}>Tổng giá trị</td>
                  <td className="p-2 text-right font-bold tabular-nums text-text-primary">{formatNumber(draftTotalValue)}đ</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile view */}
          <div className="md:hidden flex flex-col gap-3">
            {draft.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded border-border"
                />
                <span className="text-sm font-bold text-text-primary">Chọn tất cả</span>
              </div>
            )}
            
            <div className="flex flex-col gap-3">
              {draft.map((l) => {
                let unitOptions = detail.lines.find((ol) => ol.issueId === l.issueId)?.unitOptions;
                let baseUnitName = "";
                if (!unitOptions && l.purchasedItemId) {
                  const item = items.find((i) => i.id === l.purchasedItemId);
                  if (item) {
                    unitOptions = buildIssueUnitOptions(item.unitName, item.packageLines);
                    baseUnitName = item.unitName;
                  }
                } else if (l.issueId) {
                  baseUnitName = detail.lines.find((ol) => ol.issueId === l.issueId)?.baseUnitName || "";
                }

                const qtyValue = l.baseQuantity;
                const qtyText = formatNumber(qtyValue, { withDecimals: !Number.isInteger(qtyValue) });

                return (
                  <div key={l.id} className={`p-4 bg-surface-card border rounded-xl flex flex-col gap-3 ${l.removed ? "opacity-50" : ""} ${l.selected ? "border-danger bg-danger/5" : "border-border"}`}>
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label="Chọn dòng"
                        checked={l.selected}
                        onChange={() => updateLine(l.id, { selected: !l.selected })}
                        disabled={l.removed}
                        className="w-4 h-4 rounded border-border mt-1"
                      />
                      <div className="flex-1 font-medium min-w-0">
                        {l.issueId ? (
                          <span className={`text-text-primary block ${l.removed ? "line-through" : ""}`}>{l.name}</span>
                        ) : (
                          <SearchableSelect
                            value={l.purchasedItemId}
                            onChange={(val) => handleItemChange(l.id, val)}
                            options={itemOptions}
                            placeholder="Chọn mặt hàng..."
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 pl-7">
                      <div className="flex-1">
                        <select
                          aria-label="Đơn vị"
                          value={l.unitKey}
                          onChange={(e) => handleUnitChange(l.id, e.target.value)}
                          disabled={!l.purchasedItemId || l.removed}
                          className="w-full border border-border rounded-lg px-2 py-2 text-sm outline-none bg-surface-card disabled:opacity-50"
                        >
                          {unitOptions ? (
                            unitOptions.map((o) => (
                              <option key={o.key} value={o.key}>{o.label}</option>
                            ))
                          ) : (
                            <option value="">—</option>
                          )}
                        </select>
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label="Số lượng"
                          value={l.quantityInput}
                          onChange={(e) => handleQtyChange(l.id, e.target.value)}
                          disabled={!l.purchasedItemId || l.removed}
                          className="w-full border border-border rounded-lg px-2 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card disabled:opacity-50"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-end pl-7 mt-1">
                      <div className="text-sm text-text-secondary">
                        Quy ra {l.purchasedItemId ? `${qtyText} ${baseUnitName}` : "—"}
                      </div>
                      <div className="text-sm font-medium tabular-nums text-text-primary text-right">
                        {(() => {
                          if (!l.purchasedItemId) return "—";
                          const unitCost = detail.unitCostByItem?.[l.purchasedItemId];
                          if (unitCost === undefined) return "—";
                          const exactValue = unitCost * l.baseQuantity;
                          const formattedValue = formatNumber(Math.round(exactValue)) + "đ";
                          
                          if (l.removed) {
                            const oldLine = detail.lines.find(ol => ol.issueId === l.issueId);
                            if (oldLine) {
                              return <span className="line-through text-text-muted">{formatNumber(oldLine.value)}đ</span>;
                            }
                            return <span className="line-through text-text-muted">{formattedValue}</span>;
                          }
                          return formattedValue;
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <button
              type="button"
              onClick={addLine}
              className="w-full h-12 bg-surface-card border border-dashed border-primary text-primary font-bold text-sm rounded-xl flex items-center justify-center hover:bg-primary-soft transition-colors"
            >
              + Thêm dòng
            </button>
            <div className="p-4 flex justify-between font-bold text-sm bg-surface-secondary/30 rounded-xl border border-border">
              <span className="text-text-primary">Tổng giá trị</span>
              <span className="text-text-primary">{formatNumber(draftTotalValue)}đ</span>
            </div>
          </div>
          
          <div className="flex justify-end gap-2.5 mt-2">
            <Button variant="secondary" onClick={discard} disabled={isPending}>
              Bỏ thay đổi
            </Button>
            {selectedCount > 0 ? (
              <Button variant="danger" onClick={deleteSelected} disabled={isPending}>
                Xoá {selectedCount} dòng đã chọn
              </Button>
            ) : (
              <Button variant="primary" onClick={save} disabled={saveDisabled || isPending} loading={isPending}>
                Lưu thay đổi
              </Button>
            )}
          </div>
        </div>
      )}

      {dialog === "empty" && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div role="dialog" aria-label="Phiếu không còn dòng" className="w-full max-w-md p-6 rounded-2xl bg-surface-card flex flex-col gap-4 shadow-lg">
            <h2 className="m-0 text-xl font-bold text-text-primary">Phiếu không còn dòng nào. Huỷ phiếu này?</h2>
            <div className="flex justify-end gap-2.5 mt-2">
              <Button variant="secondary" onClick={() => setDialog(null)}>
                Không
              </Button>
              <Button variant="danger" onClick={() => { setDialog("cancel"); setReason(""); }}>
                Có
              </Button>
            </div>
          </div>
        </div>
      )}

      {dialog === "cancel" && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div role="dialog" aria-label="Huỷ phiếu" className="w-full max-w-md p-6 rounded-2xl bg-surface-card flex flex-col gap-4 shadow-lg">
            <h2 className="m-0 text-xl font-bold text-text-primary">Huỷ phiếu {detail.id}?</h2>
            <p className="m-0 text-sm text-text-secondary leading-relaxed">
              Toàn bộ các dòng còn hiệu lực được trả về kho hôm nay. Phiếu sẽ ẩn khỏi danh sách; chọn Loại = "Đã huỷ" để xem lại.
            </p>
            <label className="flex flex-col gap-1.5 text-sm font-bold text-text-primary">
              Lý do huỷ (bắt buộc)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Ví dụ: ghi nhầm, hàng chưa dùng"
                className="p-2.5 border border-border rounded-lg text-sm font-normal resize-none outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
              />
            </label>
            <div className="flex justify-end gap-2.5 mt-2">
              <Button variant="secondary" onClick={() => setDialog(null)} disabled={isPending}>
                Quay lại
              </Button>
              <Button variant="danger" onClick={handleConfirmCancel} disabled={!reason.trim() || isPending} loading={isPending}>
                Huỷ phiếu
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
