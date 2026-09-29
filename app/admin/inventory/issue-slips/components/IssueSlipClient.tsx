"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { confirm } from "@/lib/shared/dialog";
import { computeAffectedMonths } from "@/lib/stock/issue-slip-warnings";
import { formatConvertedOnHand } from "@/lib/stock/issue-slip-onhand-display";
import { createIssueSlip, type IssueSlipItemView } from "../actions";
import { buildIssueUnitOptions, toBaseQuantity } from "@/lib/stock/issue-unit-options";

const REASONS = [
  { value: "HAO_HUT", label: "Hao hụt / hư hỏng" },
  { value: "NOI_BO", label: "Dùng nội bộ" },
  { value: "KHAC", label: "Khác" },
] as const;

function toLocalInputValue(d: Date): string {
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

type DraftLine = {
  purchasedItemId: string;
  unitKey: string;
  packageQty: string;
};

function emptyLine(): DraftLine {
  return { purchasedItemId: "", unitKey: "", packageQty: "" };
}

export function IssueSlipClient({ items }: { items: IssueSlipItemView[] }) {
  const router = useRouter();
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("HAO_HUT");
  const [detail, setDetail] = useState("");
  const [issuedAtLocal, setIssuedAtLocal] = useState(() => toLocalInputValue(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemOptions = useMemo(() => items.map(i => ({ id: i.id, label: i.name })), [items]);

  const affectedMonths = useMemo(() => {
    const d = new Date(issuedAtLocal);
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

    const issuedAt = new Date(issuedAtLocal);
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

    const reasonLabel = REASONS.find(r => r.value === reason)?.label ?? reason;
    const note = detail.trim() ? `${reasonLabel}: ${detail.trim()}` : reasonLabel;

    setSubmitting(true);
    const res = await createIssueSlip({
      issuedAtIso: issuedAt.toISOString(),
      note,
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
      <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 space-y-5">
        <div className="space-y-3">
          {lines.map((line, index) => {
            const item = items.find(i => i.id === line.purchasedItemId);
            let options: ReturnType<typeof buildIssueUnitOptions> = [];
            if (item) {
              options = buildIssueUnitOptions(item.unitName, item.packageLines);
            }
            return (
              <div key={index} className="p-4 border border-border rounded-xl relative bg-surface-secondary/50">
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="absolute top-2 right-2 text-text-muted hover:text-danger p-2"
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
                      Tồn hiện tại: {formatConvertedOnHand(
                        item.onHand,
                        item.unitName,
                        item.packageLines.find(p => p.conversionId === line.unitKey) || {
                          conversionId: line.unitKey,
                          purchasedItemId: item.id,
                          purchasedItemName: item.name,
                          sizeLabel: "",
                          conversionRate: options.find(o => o.key === line.unitKey)?.factor ?? 1,
                          baseUnitName: item.unitName,
                          purchasedUnitName: options.find(o => o.key === line.unitKey)?.unitName ?? item.unitName,
                        },
                      )}
                    </p>
                  )}
                </div>
                <div className="flex gap-3 mt-3">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-medium text-text-muted mb-1">Quy cách</label>
                    <select
                      value={line.unitKey}
                      onChange={e => updateLine(index, { unitKey: e.target.value })}
                      disabled={!item}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
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
                      value={line.packageQty}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9,]/g, "");
                        updateLine(index, { packageQty: raw });
                      }}
                      placeholder="0"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addLine}
            className="w-full text-center text-primary-active bg-primary-soft/50 border border-dashed border-primary/30 hover:bg-primary-soft hover:border-primary/40 py-3 rounded-xl text-sm font-medium transition min-h-[44px]"
          >
            + Thêm mặt hàng
          </button>
          <p className="text-xs text-text-muted text-center">
            Đã điền đủ: {filledLineCount}/{lines.length} dòng
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Lý do</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value as (typeof REASONS)[number]["value"])}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
          >
            {REASONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Chi tiết (không bắt buộc)</label>
          <input
            type="text"
            value={detail}
            onChange={e => setDetail(e.target.value)}
            placeholder="Ví dụ: rơi vỡ khi vận chuyển..."
            className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Thời điểm xuất (áp dụng cho cả phiếu)</label>
          <input
            type="datetime-local"
            value={issuedAtLocal}
            onChange={e => setIssuedAtLocal(e.target.value)}
            className="w-full max-w-xs border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
          />
          {affectedMonths.length > 0 && (
            <p className="mt-1.5 text-xs text-warning">
              Ghi lùi ngày -- sẽ đổi giá vốn của: {affectedMonths.join(", ")}.
            </p>
          )}
        </div>

        <Button variant="primary" onClick={handleSubmit} loading={submitting} className="w-full">
          Ghi phiếu xuất ({lines.length} dòng)
        </Button>
      </div>
    </div>
  );
}

