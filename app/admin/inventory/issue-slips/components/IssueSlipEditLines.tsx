"use client";

import React from "react";
import { formatNumber } from "@/lib/shared/format";
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
  TableTotalRow,
} from "@/components/ui/Table";
import { buildIssueUnitOptions } from "@/lib/stock/issue-unit-options";
import type { IssueSlipDetail } from "@/lib/stock/issue-slip-detail";
import type { IssueSlipItemView } from "../actions";

export interface DraftLine {
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

export interface IssueSlipEditLinesProps {
  draft: DraftLine[];
  items: IssueSlipItemView[];
  itemOptions: { id: string; label: string }[];
  detail: IssueSlipDetail;
  allSelected: boolean;
  draftTotalValue: number;
  toggleAll: () => void;
  updateLine: (id: string, patch: Partial<DraftLine>) => void;
  handleItemChange: (id: string, purchasedItemId: string) => void;
  handleUnitChange: (id: string, unitKey: string) => void;
  handleQtyChange: (id: string, val: string) => void;
  addLine: () => void;
}

function getLineValueDisplay(l: DraftLine, detail: IssueSlipDetail) {
  if (!l.purchasedItemId) return "—";
  const unitCost = detail.unitCostByItem?.[l.purchasedItemId];
  if (unitCost === undefined) return "—";
  const exactValue = unitCost * l.baseQuantity;
  const formattedValue = formatNumber(Math.round(exactValue)) + "đ";

  if (l.removed) {
    const oldLine = detail.lines.find((ol) => ol.issueId === l.issueId);
    if (oldLine) {
      return (
        <span className="line-through text-text-muted">
          {formatNumber(oldLine.value)}đ
        </span>
      );
    }
    return <span className="line-through text-text-muted">{formattedValue}</span>;
  }
  return formattedValue;
}

export function IssueSlipEditLines({
  draft,
  items,
  itemOptions,
  detail,
  allSelected,
  draftTotalValue,
  toggleAll,
  updateLine,
  handleItemChange,
  handleUnitChange,
  handleQtyChange,
  addLine,
}: IssueSlipEditLinesProps): JSX.Element {
  return (
    <>
      {/* Desktop view */}
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableHeaderCell>
              <input
                type="checkbox"
                aria-label="Chọn tất cả"
                checked={allSelected}
                onChange={toggleAll}
                className="w-4 h-4 rounded border-border"
              />
            </TableHeaderCell>
            <TableHeaderCell>Mặt hàng</TableHeaderCell>
            <TableHeaderCell>Đơn vị</TableHeaderCell>
            <TableHeaderCell>Số lượng</TableHeaderCell>
            <TableHeaderCell>Quy ra</TableHeaderCell>
            <TableHeaderCell>Giá trị</TableHeaderCell>
          </TableHead>
          <TableBody>
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
                baseUnitName =
                  detail.lines.find((ol) => ol.issueId === l.issueId)?.baseUnitName || "";
              }

              const qtyValue = l.baseQuantity;
              const qtyText = formatNumber(qtyValue, {
                withDecimals: !Number.isInteger(qtyValue),
              });

              return (
                <TableRow key={l.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      aria-label="Chọn dòng"
                      checked={l.selected}
                      disabled={l.removed}
                      onChange={() => updateLine(l.id, { selected: !l.selected })}
                      className="w-4 h-4 rounded border-border"
                    />
                  </TableCell>
                  <TableCell>
                    {l.issueId ? (
                      <span className={`text-text-primary ${l.removed ? "line-through" : ""}`}>
                        {l.name}
                      </span>
                    ) : (
                      <SearchableSelect
                        value={l.purchasedItemId}
                        onChange={(val) => handleItemChange(l.id, val)}
                        options={itemOptions}
                        placeholder="Chọn mặt hàng..."
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      aria-label="Đơn vị"
                      value={l.unitKey}
                      onChange={(e) => handleUnitChange(l.id, e.target.value)}
                      disabled={!l.purchasedItemId || l.removed}
                    >
                      {unitOptions ? (
                        unitOptions.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))
                      ) : (
                        <option value="">—</option>
                      )}
                    </Select>
                  </TableCell>
                  <TableCell align="right">
                    <NumberInput
                      id={`edit-qty-${l.id}`}
                      decimals={3}
                      min={0}
                      aria-label="Số lượng"
                      value={l.quantityInput === "" ? null : Number(l.quantityInput)}
                      onValueChange={(v) => handleQtyChange(l.id, v === null ? "" : String(v))}
                      disabled={!l.purchasedItemId || l.removed}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {l.purchasedItemId ? `${qtyText} ${baseUnitName}` : "—"}
                  </TableCell>
                  <TableCell align="right">
                    {getLineValueDisplay(l, detail)}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow>
              <TableCell colSpan={6}>
                <button
                  type="button"
                  onClick={addLine}
                  className="w-full h-12 px-4 border-0 bg-transparent text-primary font-medium text-sm text-left cursor-pointer hover:bg-surface-secondary/50 transition-colors"
                >
                  + Thêm dòng
                </button>
              </TableCell>
            </TableRow>
          </TableBody>
          <TableTotalRow>
            <TableCell />
            <TableCell colSpan={4}>Tổng giá trị</TableCell>
            <TableCell align="right">{formatNumber(draftTotalValue)}đ</TableCell>
          </TableTotalRow>
        </Table>
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
            <span className="text-sm font-medium text-text-primary">Chọn tất cả</span>
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
              baseUnitName =
                detail.lines.find((ol) => ol.issueId === l.issueId)?.baseUnitName || "";
            }

            const qtyValue = l.baseQuantity;
            const qtyText = formatNumber(qtyValue, {
              withDecimals: !Number.isInteger(qtyValue),
            });

            return (
              <div
                key={l.id}
                className={`p-4 bg-surface-card border rounded-xl flex flex-col gap-3 ${
                  l.removed ? "opacity-50" : ""
                } ${l.selected ? "border-danger bg-danger/5" : "border-border"}`}
              >
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
                      <span className={`text-text-primary block ${l.removed ? "line-through" : ""}`}>
                        {l.name}
                      </span>
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
                    <Select
                      aria-label="Đơn vị"
                      value={l.unitKey}
                      onChange={(e) => handleUnitChange(l.id, e.target.value)}
                      disabled={!l.purchasedItemId || l.removed}
                    >
                      {unitOptions ? (
                        unitOptions.map((o) => (
                          <option key={o.key} value={o.key}>
                            {o.label}
                          </option>
                        ))
                      ) : (
                        <option value="">—</option>
                      )}
                    </Select>
                  </div>
                  <div className="flex-1">
                    <NumberInput
                      id={`edit-qty-m-${l.id}`}
                      decimals={3}
                      min={0}
                      aria-label="Số lượng"
                      value={l.quantityInput === "" ? null : Number(l.quantityInput)}
                      onValueChange={(v) => handleQtyChange(l.id, v === null ? "" : String(v))}
                      disabled={!l.purchasedItemId || l.removed}
                    />
                  </div>
                </div>
                <div className="flex justify-between items-end pl-7 mt-1">
                  <div className="text-sm text-text-secondary">
                    Quy ra {l.purchasedItemId ? `${qtyText} ${baseUnitName}` : "—"}
                  </div>
                  <div className="text-sm font-normal tabular-nums text-text-primary text-right">
                    {getLineValueDisplay(l, detail)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addLine}
          className="w-full h-12 bg-surface-card border border-dashed border-primary text-primary font-medium text-sm rounded-xl flex items-center justify-center hover:bg-primary-soft transition-colors"
        >
          + Thêm dòng
        </button>
        <div className="p-4 flex justify-between font-normal text-sm bg-primary-soft rounded-card border border-border">
          <span className="font-medium text-text-primary">Tổng giá trị</span>
          <span className="font-medium text-text-primary tabular-nums">
            {formatNumber(draftTotalValue)}đ
          </span>
        </div>
      </div>
    </>
  );
}
