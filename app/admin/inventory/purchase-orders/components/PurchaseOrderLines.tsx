"use client";

import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Select } from "@/components/ui/Select";
import { NumberInput } from "@/components/ui/NumberInput";
import { formatNumber } from "@/lib/shared/format";
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
}: PurchaseOrderLinesProps): JSX.Element {
  return (
    <div className="mb-6">
      <div className="flex justify-between items-end mb-4">
        <h3 className="text-lg font-semibold text-text-primary">Chi tiết nhập hàng</h3>
      </div>

      {lines.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-surface-secondary flex flex-col items-center justify-center">
          <p className="text-text-muted mb-4">Chưa có mặt hàng nào.</p>
          <button
            type="button"
            onClick={addLine}
            className="text-primary-active bg-primary-soft/50 hover:bg-primary-soft px-6 py-2.5 rounded-lg text-sm font-medium transition"
          >
            + Thêm Mặt Hàng Đầu Tiên
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {lines.map((line, index) => {
            const itemRowId = `${formId}-item-${index}`;
            const availableUnits = conversions.filter(
              (c: any) => c.purchased_item_id === line.purchased_item_id && c.status !== "INACTIVE"
            );
            const unitPrice =
              Number(line.quantity) > 0 ? Number(line.subtotal) / Number(line.quantity) : 0;

            return (
              <div
                key={index}
                className="p-4 border border-border rounded-xl relative bg-surface-secondary/50"
              >
                <button
                  type="button"
                  onClick={() => removeLine(index)}
                  aria-label="Xoá dòng"
                  className="absolute top-4 right-4 text-text-muted hover:text-danger min-h-[44px] min-w-[44px] flex items-center justify-center"
                >
                  ✕
                </button>

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
                      placeholder="-- Chọn Hàng --"
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
                          const unitName =
                            units.find((x: any) => x.id === pUnit || x.name === pUnit)?.name ||
                            pUnit;
                          const baseUnitName =
                            units.find((x: any) => x.id === bUnit || x.name === bUnit)?.name ||
                            bUnit;
                          return (
                            <option key={u.id} value={u.id}>
                              {unitName} {u.conversion_rate}
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
              </div>
            );
          })}

          <button
            type="button"
            onClick={addLine}
            className="mt-4 w-full text-center text-primary-active bg-primary-soft/50 border border-dashed border-primary/30 hover:bg-primary-soft hover:border-primary/40 py-3 rounded-xl text-sm font-medium transition"
          >
            + Thêm Mặt Hàng
          </button>
        </div>
      )}
    </div>
  );
}

export default PurchaseOrderLines;
