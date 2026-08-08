"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import { confirm } from "@/lib/dialog";
import { computeAffectedMonths } from "@/lib/issue-slip-warnings";
import { createIssueSlip, type IssueSlipItemView } from "../actions";
import type { ManualIssueResult } from "@/lib/manual-issue-transaction";

// I1/I2: the two reasons the plan names explicitly, plus a free-form escape
// hatch -- the RPC does not care which is picked, this only shapes the note
// so a reader of stock_issues later knows why the shelf moved.
const REASONS = [
  { value: "HAO_HUT", label: "Hao hụt / hư hỏng" },
  { value: "NOI_BO", label: "Dùng nội bộ" },
  { value: "KHAC", label: "Khác" },
] as const;

function toLocalInputValue(d: Date): string {
  const offsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function IssueSlipClient({ items }: { items: IssueSlipItemView[] }) {
  const [result, setResult] = useState<ManualIssueResult | null>(null);

  if (result) {
    return <SubmittedView result={result} items={items} onNew={() => setResult(null)} />;
  }
  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Phiếu Xuất Kho" subtitle="Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." />
        <EmptyState icon="📦" title="Không có mặt hàng nào" description="Không tìm thấy hàng mua vào nào để lập phiếu xuất." />
      </div>
    );
  }
  return <FormView items={items} onSubmitted={setResult} />;
}

function FormView({
  items,
  onSubmitted,
}: {
  items: IssueSlipItemView[];
  onSubmitted: (result: ManualIssueResult) => void;
}) {
  const [itemId, setItemId] = useState(items[0]?.id ?? "");
  const [conversionId, setConversionId] = useState(items[0]?.packageLines[0]?.conversionId ?? "");
  const [packageQty, setPackageQty] = useState("");
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("HAO_HUT");
  const [detail, setDetail] = useState("");
  const [issuedAtLocal, setIssuedAtLocal] = useState(() => toLocalInputValue(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const item = items.find(i => i.id === itemId) ?? items[0];
  const pkg = item?.packageLines.find(p => p.conversionId === conversionId) ?? item?.packageLines[0];
  const parsedQty = Number(packageQty);
  const baseQty = pkg && Number.isFinite(parsedQty) ? parsedQty * pkg.conversionRate : null;

  const affectedMonths = useMemo(() => {
    const d = new Date(issuedAtLocal);
    if (Number.isNaN(d.getTime())) return [];
    return computeAffectedMonths(d);
  }, [issuedAtLocal]);

  function handleItemChange(newItemId: string) {
    setItemId(newItemId);
    const newItem = items.find(i => i.id === newItemId);
    setConversionId(newItem?.packageLines[0]?.conversionId ?? "");
  }

  async function handleSubmit() {
    setError(null);
    if (!item || !pkg) {
      setError("Chưa chọn mặt hàng hoặc quy cách");
      return;
    }
    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError("Số lượng phải lớn hơn 0");
      return;
    }
    const issuedAt = new Date(issuedAtLocal);
    if (Number.isNaN(issuedAt.getTime())) {
      setError("Thời điểm xuất không hợp lệ");
      return;
    }

    // I6: a backdated slip changes a closed period's cost -- the owner must
    // see which months before this is written, not discover it later.
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
      purchasedItemId: item.id,
      baseQuantity: parsedQty * pkg.conversionRate,
      issuedAtIso: issuedAt.toISOString(),
      note,
    });
    setSubmitting(false);
    if (res.error || !res.result) {
      // I4/I5 refusals from the RPC surface here verbatim -- they already
      // name the item, the shortfall, and the shop's own numbers.
      setError(res.error || "Không thể ghi phiếu xuất");
      return;
    }
    onSubmitted(res.result);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Phiếu Xuất Kho" subtitle="Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." />
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 max-w-xl mx-auto space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Mặt hàng</label>
          <select
            value={itemId}
            onChange={e => handleItemChange(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
          >
            {items.map(i => (
              <option key={i.id} value={i.id}>
                {i.name} (tồn {formatNumber(i.onHand)} {i.unitName})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Quy cách</label>
            <select
              value={conversionId}
              onChange={e => setConversionId(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
            >
              {item?.packageLines.map(p => (
                <option key={p.conversionId} value={p.conversionId}>{p.sizeLabel}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Số lượng</label>
            <input
              type="number"
              min="0"
              step="any"
              value={packageQty}
              onChange={e => setPackageQty(e.target.value)}
              placeholder="0"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-right outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
            />
          </div>
        </div>
        {baseQty !== null && pkg && (
          <div className="text-xs text-text-secondary">
            = {formatNumber(baseQty)} {item?.unitName} &middot; tồn hiện tại {formatNumber(item?.onHand ?? 0)} {item?.unitName}
          </div>
        )}

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
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            rows={2}
            placeholder="Ví dụ: rơi vỡ khi vận chuyển..."
            className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-text-muted mb-1.5 tracking-wider">Thời điểm xuất</label>
          <input
            type="datetime-local"
            value={issuedAtLocal}
            onChange={e => setIssuedAtLocal(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
          />
          {affectedMonths.length > 0 && (
            <p className="mt-1.5 text-xs text-warning">
              Ghi lùi ngày -- sẽ đổi giá vốn của: {affectedMonths.join(", ")}.
            </p>
          )}
        </div>

        <Button variant="primary" onClick={handleSubmit} loading={submitting}>
          Ghi phiếu xuất
        </Button>
      </div>
    </div>
  );
}

function SubmittedView({
  result,
  items,
  onNew,
}: {
  result: ManualIssueResult;
  items: IssueSlipItemView[];
  onNew: () => void;
}) {
  const itemName = items.find(i => i.id === result.purchasedItemId)?.name ?? result.purchasedItemId;
  return (
    <div className="space-y-6">
      <PageHeader title="Phiếu Xuất Kho" subtitle="Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." />
      <Alert variant="success" title={`Đã ghi phiếu ${result.issueId}`}>
        <div>
          Xuất {formatNumber(result.baseQuantity)} cho {itemName}. Tồn còn lại (tính tới thời điểm xuất):{" "}
          {formatNumber(result.onHandAfter)}.
        </div>
      </Alert>
      <Button variant="secondary" onClick={onNew}>Lập phiếu khác</Button>
    </div>
  );
}
