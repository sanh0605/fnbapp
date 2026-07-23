"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ClipboardCheck } from "lucide-react";
import {
  openShiftStockCheck,
  closeShiftStockCheck,
  type CheckedItem,
  type ActiveShiftStockCheck,
} from "@/app/admin/reports/stock/shift-check-actions";
import type { ShiftStockCheckResultRow } from "@/lib/shift-stock-check-transaction";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
}

function VarianceBadge({ variance }: { variance: number }) {
  if (variance === 0) return <Badge variant="success">Khớp</Badge>;
  return <Badge variant="danger">{variance > 0 ? `+${variance}` : variance}</Badge>;
}

function itemName(checkedItems: CheckedItem[], itemReference: string) {
  return checkedItems.find((i) => i.itemReference === itemReference)?.name ?? itemReference;
}

// Not mandatory before selling -- pure record/review feature, independent
// of POS checkout. Functional-only per owner instruction.
export default function ShiftStockCheckPanel({
  checkedItems,
  initialActiveShift,
}: {
  checkedItems: CheckedItem[];
  initialActiveShift: ActiveShiftStockCheck | null;
}) {
  const [activeShift, setActiveShift] = useState(initialActiveShift);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ mode: "OPEN" | "CLOSE"; checks: ShiftStockCheckResultRow[] } | null>(null);

  const mode: "OPEN" | "CLOSE" = activeShift ? "CLOSE" : "OPEN";

  function openForm() {
    setError(null);
    setCounts(Object.fromEntries(checkedItems.map((i) => [i.itemReference, ""])));
    setIsFormOpen(true);
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    const parsed: Record<string, number> = {};
    for (const item of checkedItems) {
      const raw = counts[item.itemReference];
      const value = Number(raw);
      if (raw === undefined || raw === "" || !Number.isFinite(value) || value < 0) {
        setError(`Nhập số lượng hợp lệ cho ${item.name}`);
        setIsSubmitting(false);
        return;
      }
      parsed[item.itemReference] = value;
    }

    const res = mode === "OPEN"
      ? await openShiftStockCheck(parsed)
      : await closeShiftStockCheck(activeShift!.shift.id, parsed);

    setIsSubmitting(false);
    if (!res.success) {
      setError(res.error);
      return;
    }

    setLastResult({ mode, checks: res.shift.checks });
    setIsFormOpen(false);
    if (mode === "OPEN") {
      setActiveShift({
        shift: {
          id: res.shift.id,
          status: "OPEN",
          openedByName: res.shift.opened_by_name,
          openedAt: res.shift.opened_at,
          notes: res.shift.notes ?? "",
        },
        openChecks: res.shift.checks,
      });
    } else {
      setActiveShift(null);
    }
  }

  if (checkedItems.length === 0) {
    return null;
  }

  return (
    <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
      <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" /> Kiểm ca
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Đếm thực tế đầu/cuối ca cho {checkedItems.map((i) => i.name).join(", ")} -- chỉ ghi nhận để xem lại, không tự sửa tồn kho.
          </p>
        </div>
        {activeShift ? (
          <div className="flex items-center gap-3">
            <Badge variant="processing">
              Đang mở ca -- {activeShift.shift.openedByName} lúc {formatDateTime(activeShift.shift.openedAt)}
            </Badge>
            <Button variant="secondary" size="sm" onClick={openForm}>Đóng ca</Button>
          </div>
        ) : (
          <Button size="sm" onClick={openForm}>Mở ca</Button>
        )}
      </div>

      {lastResult && (
        <div className="p-4 border-b border-border">
          <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
            Kết quả {lastResult.mode === "OPEN" ? "mở ca" : "đóng ca"} gần nhất
          </p>
          <table className="w-full text-sm">
            <thead className="text-text-muted">
              <tr>
                <th className="text-left py-1">Mặt hàng</th>
                <th className="text-right py-1">Đếm được</th>
                <th className="text-right py-1">Lý thuyết</th>
                <th className="text-right py-1">Lệch</th>
              </tr>
            </thead>
            <tbody>
              {lastResult.checks.map((c) => (
                <tr key={c.id} className="border-t border-border/50">
                  <td className="py-1.5 text-text-primary font-medium">{itemName(checkedItems, c.item_reference)}</td>
                  <td className="py-1.5 text-right">{c.counted_qty}</td>
                  <td className="py-1.5 text-right text-text-secondary">{c.theoretical_qty}</td>
                  <td className="py-1.5 text-right"><VarianceBadge variance={c.variance} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={mode === "OPEN" ? "Mở ca -- đếm thực tế" : "Đóng ca -- đếm thực tế"}>
        <div className="space-y-4">
          {error && (
            <div role="alert" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">{error}</div>
          )}
          {checkedItems.map((item) => (
            <div key={item.itemReference}>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                {item.name} ({item.unitName})
              </label>
              <input
                type="number"
                min={0}
                step="1"
                value={counts[item.itemReference] ?? ""}
                onChange={(e) => setCounts((prev) => ({ ...prev, [item.itemReference]: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
                placeholder="Số lượng đếm được"
              />
            </div>
          ))}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>Huỷ</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Đang lưu..." : mode === "OPEN" ? "Mở ca" : "Đóng ca"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
