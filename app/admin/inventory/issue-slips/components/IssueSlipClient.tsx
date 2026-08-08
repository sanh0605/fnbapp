"use client";

import { useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/datetime";
import { confirm } from "@/lib/dialog";
import { computeAffectedMonths } from "@/lib/issue-slip-warnings";
import { createIssueSlip, reverseIssueSlip, type IssueSlipItemView, type IssueSlipRow } from "../actions";
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

export function IssueSlipClient({
  items,
  recentSlips,
}: {
  items: IssueSlipItemView[];
  recentSlips: IssueSlipRow[];
}) {
  const [result, setResult] = useState<ManualIssueResult | null>(null);

  if (result) {
    return (
      <SubmittedView result={result} items={items} recentSlips={recentSlips} onNew={() => setResult(null)} />
    );
  }
  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Phiếu Xuất Kho" subtitle="Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." />
        <EmptyState icon="📦" title="Không có mặt hàng nào" description="Không tìm thấy hàng mua vào nào để lập phiếu xuất." />
        <RecentSlipsSection recentSlips={recentSlips} />
      </div>
    );
  }
  return <FormView items={items} recentSlips={recentSlips} onSubmitted={setResult} />;
}

function FormView({
  items,
  recentSlips,
  onSubmitted,
}: {
  items: IssueSlipItemView[];
  recentSlips: IssueSlipRow[];
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

      <RecentSlipsSection recentSlips={recentSlips} />
    </div>
  );
}

function SubmittedView({
  result,
  items,
  recentSlips,
  onNew,
}: {
  result: ManualIssueResult;
  items: IssueSlipItemView[];
  recentSlips: IssueSlipRow[];
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

      <RecentSlipsSection recentSlips={recentSlips} />
    </div>
  );
}

/**
 * Plan D D7b, BR-INV-009 -- D7a's screen was create-only, with no way to
 * find a past slip to reverse. Each MANUAL row that is not itself a
 * reversal, and has not already been reversed, gets a "Đảo phiếu" button.
 * A reversed pair shows both rows linked, neither ever deleted or edited.
 */
function RecentSlipsSection({ recentSlips }: { recentSlips: IssueSlipRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleReverse(row: IssueSlipRow) {
    const note = (reasonById[row.id] ?? "").trim();
    const approved = await confirm({
      title: `Đảo phiếu ${row.id}?`,
      message:
        "Phiếu gốc được giữ nguyên, không xoá. Một dòng bù sẽ được ghi hôm nay, theo giá bình quân hiện tại " +
        "(BR-INV-009) -- không phải giá của phiếu gốc.",
      variant: "warning",
    });
    if (!approved) return;

    setError(null);
    setReversingId(row.id);
    startTransition(async () => {
      const res = await reverseIssueSlip({ issueId: row.id, note });
      setReversingId(null);
      if (res.error) setError(res.error);
    });
  }

  if (recentSlips.length === 0) return null;

  return (
    <div className="bg-surface-card rounded-card shadow-sm border border-border p-5">
      <h2 className="font-bold text-text-primary mb-3">Phiếu xuất gần đây</h2>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="space-y-2 text-sm">
        {recentSlips.map(row => {
          const isReversal = row.reversesIssueId !== null;
          const alreadyReversed = row.reversedByIssueId !== null;
          return (
            <div key={row.id} className="border-b border-border pb-2 last:border-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="font-medium text-text-primary">{row.itemName}</span>{" "}
                  <span className={row.baseQuantity < 0 ? "text-success" : "text-text-secondary"}>
                    {row.baseQuantity > 0 ? "-" : "+"}{formatNumber(Math.abs(row.baseQuantity))}
                  </span>
                  <span className="ml-2 text-text-muted text-xs">{formatDateTime(row.issuedAt)}</span>
                  {isReversal && <span className="ml-2 text-xs text-warning">Đảo phiếu {row.reversesIssueId}</span>}
                  {alreadyReversed && <span className="ml-2 text-xs text-success">Đã đảo bởi {row.reversedByIssueId}</span>}
                </div>
                {!isReversal && !alreadyReversed && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleReverse(row)}
                    loading={isPending && reversingId === row.id}
                  >
                    Đảo phiếu
                  </Button>
                )}
              </div>
              {row.note && <div className="text-xs text-text-secondary mt-0.5">{row.note}</div>}
              {!isReversal && !alreadyReversed && (
                <input
                  type="text"
                  placeholder="Lý do đảo phiếu (không bắt buộc)"
                  value={reasonById[row.id] ?? ""}
                  onChange={e => setReasonById(prev => ({ ...prev, [row.id]: e.target.value }))}
                  className="mt-1.5 w-full border border-border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
