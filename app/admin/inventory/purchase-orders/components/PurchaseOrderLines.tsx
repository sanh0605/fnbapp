"use client";

import { useState } from "react";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { formatNumber } from "@/lib/shared/format";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import type { DBPurchasedItem, DBUOMConversion, DBUnit } from "@/types/db";

export interface PurchaseOrderLinesProps {
  lines: any[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
  formId: string;
  addLine: () => void;
  removeLine: (index: number) => void;
  updateLine: (index: number, field: string, value: any) => void;
  openIndex?: number | null;
  setOpenIndex?: (index: number | null) => void;
  errorIndex?: number | null;
}

export function PurchaseOrderLines({
  lines,
  items,
  conversions,
  units,
  formId,
  addLine,
  removeLine,
  updateLine,
  openIndex: externalOpenIndex,
  setOpenIndex: externalSetOpenIndex,
  errorIndex = null,
}: PurchaseOrderLinesProps) {
  const [internalOpenIndex, setInternalOpenIndex] = useState<number | null>(null);
  const openIndex = externalOpenIndex !== undefined ? externalOpenIndex : internalOpenIndex;
  const setOpenIndex = externalSetOpenIndex !== undefined ? externalSetOpenIndex : setInternalOpenIndex;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-end mb-4">
        <h3 className="text-sm text-text-secondary mb-3">Hàng nhập</h3>
      </div>

      {lines.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-surface-secondary flex flex-col items-center justify-center">
          <p className="text-text-muted mb-4">Chưa có mặt hàng nào.</p>
          <Button
            type="button"
            variant="secondary"
            onClick={addLine}
            className="min-h-[48px] md:min-h-[40px]"
          >
            + Thêm mặt hàng đầu tiên
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {lines.map((line, index) => {
            const itemRowId = `${formId}-item-${index}`;
            const item = items.find((i: any) => i.id === line.purchased_item_id);
            const itemName = item?.name || "Chưa chọn hàng";

            const availableUnits = conversions.filter(
              (c: any) => c.purchased_item_id === line.purchased_item_id && c.status !== "INACTIVE"
            );
            const conv = conversions.find((c: any) => c.id === line.conversion_id);
            const unitName =
              conv?.purchased_unit ||
              line.unit ||
              units.find((x: any) => x.id === conv?.from_unit_id)?.name ||
              "";

            const unitPrice =
              Number(line.quantity) > 0 ? Number(line.subtotal) / Number(line.quantity) : 0;

            const isOpen = openIndex === index;
            const hasError = errorIndex === index;

            return (
              <div
                key={index}
                data-testid="po-line-card"
                className={`p-4 border rounded-xl relative bg-surface-secondary/50 ${
                  hasError ? "border-danger" : "border-border"
                }`}
              >
                {/* Collapsed phone view */}
                <div
                  className={`md:hidden ${isOpen ? "hidden" : "block cursor-pointer"}`}
                  onClick={() => setOpenIndex(index)}
                  role="button"
                  tabIndex={0}
                >
                  <PhoneRow
                    title={itemName}
                    value={`${formatNumber(Number(line.subtotal) || 0)}đ`}
                    meta={`${line.quantity || 0} ${unitName} × ${formatNumber(Math.round(unitPrice))}đ`}
                  />
                </div>

                {/* Form inputs: always shown on desktop (md:block); on phone only shown when isOpen */}
                <div className={isOpen ? "block" : "hidden md:block"}>
                  <Button
                    type="button"
                    variant="delete"
                    onClick={() => removeLine(index)}
                    aria-label="Xoá dòng"
                    className="hidden md:inline-flex absolute top-4 right-4 min-h-[40px] min-w-[40px] p-0"
                  >
                    ✕
                  </Button>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                      <label
                        htmlFor={`${itemRowId}-purchased_item_id`}
                        className="block text-xs font-medium text-text-muted mb-1"
                      >
                        Mặt hàng
                      </label>
                      <SearchableSelect
                        id={`${itemRowId}-purchased_item_id`}
                        value={line.purchased_item_id}
                        onChange={(val) => updateLine(index, "purchased_item_id", val)}
                        options={items.map((i: any) => ({ id: i.id, label: i.name }))}
                        placeholder="Chọn hàng"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <label
                        htmlFor={`${itemRowId}-conversion_id`}
                        className="block text-xs font-medium text-text-muted mb-1"
                      >
                        Đơn vị nhập
                      </label>
                      <div className="space-y-2">
                        <Select
                          id={`${itemRowId}-conversion_id`}
                          value={line.conversion_id || ""}
                          onChange={(e) => updateLine(index, "conversion_id", e.target.value)}
                          disabled={!line.purchased_item_id}
                        >
                          <option value="">-- Chọn --</option>
                          {availableUnits.map((u: any) => {
                            const pUnit = String(u.purchased_unit).trim();
                            const bUnit = String(u.base_unit).trim();
                            const uName =
                              units.find((x: any) => x.id === pUnit || x.name === pUnit)?.name ||
                              pUnit;
                            const baseUnitName =
                              units.find((x: any) => x.id === bUnit || x.name === bUnit)?.name ||
                              bUnit;
                            return (
                              <option key={u.id} value={u.id}>
                                {uName} {u.conversion_rate}
                                {baseUnitName}
                              </option>
                            );
                          })}
                        </Select>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor={`${itemRowId}-quantity`}
                        className="block text-xs font-medium text-text-muted mb-1"
                      >
                        Số lượng
                      </label>
                      <NumberInput
                        id={`${itemRowId}-quantity`}
                        decimals={3}
                        min={0}
                        minExclusive
                        example="2"
                        value={
                          line.quantity === "" || line.quantity == null
                            ? null
                            : Number(line.quantity)
                        }
                        onValueChange={(v) =>
                          updateLine(index, "quantity", v === null ? "" : String(v))
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label
                        htmlFor={`${itemRowId}-subtotal`}
                        className="block text-xs font-medium text-text-muted mb-1"
                      >
                        Thành tiền (đ)
                      </label>
                      <NumberInput
                        id={`${itemRowId}-subtotal`}
                        decimals={0}
                        zeroIsEmpty
                        example="150,000"
                        value={
                          line.subtotal === "" || line.subtotal == null
                            ? null
                            : Number(line.subtotal)
                        }
                        onValueChange={(v) =>
                          updateLine(index, "subtotal", v === null ? "" : String(v))
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-text-muted mb-1">
                        Đơn giá
                      </label>
                      <div className="py-2 text-sm text-text-secondary">
                        {formatNumber(unitPrice)}
                      </div>
                    </div>
                  </div>

                  {/* Phone action buttons: only shown when open on mobile */}
                  {isOpen && (
                    <div className="flex md:hidden items-center justify-end gap-3 pt-3 border-t border-border mt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => removeLine(index)}
                        className="min-h-[48px] text-danger"
                      >
                        Xoá dòng
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setOpenIndex(null)}
                        className="min-h-[48px]"
                      >
                        Xong
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="secondary"
            onClick={addLine}
            className="mt-4 w-full min-h-[48px] md:min-h-[40px]"
          >
            + Thêm mặt hàng
          </Button>
        </div>
      )}
    </div>
  );
}

export default PurchaseOrderLines;
