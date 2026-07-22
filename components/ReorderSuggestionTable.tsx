"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { PackageSearch } from "lucide-react";
import type { ReorderSuggestion } from "@/lib/reorder-suggestion";

function formatQty(value: number | null, unit: string | null | undefined) {
  if (value === null) return "-";
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} ${unit ?? ""}`.trim();
}

function StatusBadge({ s }: { s: ReorderSuggestion }) {
  if (!s.hasSufficientData) return <Badge variant="neutral">Chưa đủ dữ liệu</Badge>;
  if (s.isLowStock) return <Badge variant="danger">Cần đặt hàng</Badge>;
  return <Badge variant="success">Đủ tồn</Badge>;
}

// FC-2: functional-only per owner instruction -- visual polish deferred to the later UI/UX redesign phase.
export default function ReorderSuggestionTable({ suggestions }: { suggestions: ReorderSuggestion[] }) {
  const [onlyLowStock, setOnlyLowStock] = useState(true);

  const lowStockCount = suggestions.filter((s) => s.isLowStock).length;
  const visible = onlyLowStock ? suggestions.filter((s) => s.isLowStock) : suggestions;
  const sorted = [...visible].sort((a, b) => {
    if (a.isLowStock !== b.isLowStock) return a.isLowStock ? -1 : 1;
    return a.itemName.localeCompare(b.itemName, "vi");
  });

  return (
    <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            <PackageSearch className="w-5 h-5" /> Gợi ý đặt hàng lại
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Tính từ tốc độ tiêu thụ thực tế — chỉ là gợi ý, không tự tạo đơn đặt hàng.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyLowStock}
            onChange={(e) => setOnlyLowStock(e.target.checked)}
            className="rounded border-border"
          />
          Chỉ hiện hàng cần đặt ({lowStockCount})
        </label>
      </div>

      {sorted.length === 0 ? (
        <div className="p-6 text-center text-sm text-text-muted">
          {onlyLowStock ? "Không có mặt hàng nào cần đặt lại." : "Chưa có dữ liệu."}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto max-h-[50vh] overflow-y-auto hidden md:block">
            <table className="w-full text-left text-sm text-text-secondary">
              <thead className="bg-page text-text-muted font-medium sticky top-0 border-b border-border shadow-sm z-10">
                <tr>
                  <th className="px-6 py-3">Tên</th>
                  <th className="px-6 py-3">Loại</th>
                  <th className="px-6 py-3 text-right">Tồn hiện tại</th>
                  <th className="px-6 py-3 text-right">Mức cần đặt lại</th>
                  <th className="px-6 py-3 text-right">Đề xuất đặt</th>
                  <th className="px-6 py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {sorted.map((s) => (
                  <tr key={s.itemId} className="hover:bg-page transition">
                    <td className="px-6 py-3 font-medium text-text-primary">{s.itemName}</td>
                    <td className="px-6 py-3">
                      <Badge variant={s.itemType === "SEMI_PRODUCT" ? "processing" : "neutral"}>
                        {s.itemType === "SEMI_PRODUCT" ? "Bán thành phẩm" : "Nguyên liệu"}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <span className={`font-bold ${s.isLowStock ? "text-danger" : "text-text-primary"}`}>
                        {formatQty(s.currentStock, s.baseUnitName)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right text-text-secondary">
                      {formatQty(s.reorderPoint, s.baseUnitName)}
                    </td>
                    <td className="px-6 py-3 text-right font-semibold text-text-primary">
                      {formatQty(
                        s.suggestedReorderQtyPurchaseUnit ?? s.suggestedReorderQtyBaseUnit,
                        s.suggestedReorderQtyPurchaseUnit !== null ? s.purchaseUnitName : s.baseUnitName
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1">
                        <StatusBadge s={s} />
                        {s.hasSufficientData && s.leadTimeIsDefault && (
                          <span
                            className="text-[10px] text-text-muted"
                            title="Chưa có lịch sử nhập hàng cho mặt hàng này, đang dùng thời gian chờ mặc định 3 ngày"
                          >
                            (ước tính)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="space-y-3 p-4 md:hidden">
            {sorted.map((s) => (
              <div key={s.itemId} className="bg-page rounded-xl border border-border p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-text-primary text-sm">{s.itemName}</h4>
                    <div className="mt-1">
                      <Badge variant={s.itemType === "SEMI_PRODUCT" ? "processing" : "neutral"}>
                        {s.itemType === "SEMI_PRODUCT" ? "Bán thành phẩm" : "Nguyên liệu"}
                      </Badge>
                    </div>
                  </div>
                  <StatusBadge s={s} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/50">
                  <div>
                    <p className="text-text-muted">Tồn hiện tại</p>
                    <p className={`font-bold ${s.isLowStock ? "text-danger" : "text-text-primary"}`}>
                      {formatQty(s.currentStock, s.baseUnitName)}
                    </p>
                  </div>
                  <div>
                    <p className="text-text-muted">Mức cần đặt lại</p>
                    <p className="font-medium text-text-secondary">{formatQty(s.reorderPoint, s.baseUnitName)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-text-muted">Đề xuất đặt</p>
                    <p className="font-bold text-text-primary">
                      {formatQty(
                        s.suggestedReorderQtyPurchaseUnit ?? s.suggestedReorderQtyBaseUnit,
                        s.suggestedReorderQtyPurchaseUnit !== null ? s.purchaseUnitName : s.baseUnitName
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
