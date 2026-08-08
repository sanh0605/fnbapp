"use client";

import { useMemo, useState, useTransition } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SearchableSelect } from "@/components/SearchableSelect";
import { formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/datetime";
import { confirm } from "@/lib/dialog";
import { computeAffectedMonths } from "@/lib/issue-slip-warnings";
import { createIssueSlip, reverseIssueSlip, type IssueSlipItemView, type IssueSlipRow } from "../actions";
import type { IssueSlipResult } from "@/lib/manual-issue-transaction";

// I1/I2: the two reasons the plan names explicitly, plus a free-form escape
// hatch -- the RPC does not care which is picked, this only shapes the note
// so a reader of stock_issues later knows why the shelf moved. One reason
// for the whole slip, not one per line -- throwing away five spoiled
// things is one event to the owner (D9), not five separate justifications.
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
  conversionId: string;
  packageQty: string;
};

function emptyLine(): DraftLine {
  return { purchasedItemId: "", conversionId: "", packageQty: "" };
}

export function IssueSlipClient({
  items,
  recentSlips,
}: {
  items: IssueSlipItemView[];
  recentSlips: IssueSlipRow[];
}) {
  const [result, setResult] = useState<IssueSlipResult | null>(null);

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

// D9: one slip, one time, many lines -- mirrors PurchaseOrderForm.tsx (the
// screen the owner already knows: SearchableSelect per line, an add/remove
// line list) rather than the one-item-per-form D7a shape. The owner's own
// review: "tại sao phiếu xuất kho 1 lần chỉ cho xuất đúng 1 sản phẩm."
function FormView({
  items,
  recentSlips,
  onSubmitted,
}: {
  items: IssueSlipItemView[];
  recentSlips: IssueSlipRow[];
  onSubmitted: (result: IssueSlipResult) => void;
}) {
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
    updateLine(index, { purchasedItemId, conversionId: newItem?.packageLines[0]?.conversionId ?? "" });
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
      const pkg = item.packageLines.find(p => p.conversionId === line.conversionId);
      if (!pkg) {
        setError(`Dòng ${i + 1}: chưa chọn quy cách`);
        return;
      }
      const parsedQty = Number(line.packageQty);
      if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
        setError(`Dòng ${i + 1}: số lượng phải lớn hơn 0`);
        return;
      }
      payloadLines.push({ purchasedItemId: item.id, baseQuantity: parsedQty * pkg.conversionRate });
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
      issuedAtIso: issuedAt.toISOString(),
      note,
      lines: payloadLines,
    });
    setSubmitting(false);
    if (res.error || !res.result) {
      // I4/I5/I10 refusals from the RPC surface here verbatim -- they
      // already name the line, the shortfall, and the shop's own numbers.
      setError(res.error || "Không thể ghi phiếu xuất");
      return;
    }
    onSubmitted(res.result);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Phiếu Xuất Kho" subtitle="Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." />
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 space-y-5">
        <div className="space-y-3">
          {lines.map((line, index) => {
            const item = items.find(i => i.id === line.purchasedItemId);
            return (
              <div key={index} className="p-4 border border-border rounded-xl relative bg-surface-secondary/50">
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="absolute top-4 right-4 text-text-muted hover:text-danger"
                    aria-label="Xoá dòng"
                  >
                    ✕
                  </button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-5">
                    <label className="block text-xs font-medium text-text-muted mb-1">Mặt hàng</label>
                    <SearchableSelect
                      value={line.purchasedItemId}
                      onChange={val => handleItemChange(index, val)}
                      options={itemOptions}
                      placeholder="-- Chọn hàng --"
                    />
                    {item && (
                      <p className="mt-1 text-xs text-text-muted">Tồn hiện tại: {formatNumber(item.onHand)} {item.unitName}</p>
                    )}
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-text-muted mb-1">Quy cách</label>
                    <select
                      value={line.conversionId}
                      onChange={e => updateLine(index, { conversionId: e.target.value })}
                      disabled={!item}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
                    >
                      <option value="">-- Chọn --</option>
                      {item?.packageLines.map(p => (
                        <option key={p.conversionId} value={p.conversionId}>{p.sizeLabel}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-text-muted mb-1">Số lượng</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={line.packageQty}
                      onChange={e => updateLine(index, { packageQty: e.target.value })}
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
            className="w-full text-center text-primary-active bg-primary-soft/50 border border-dashed border-primary/30 hover:bg-primary-soft hover:border-primary/40 py-3 rounded-xl text-sm font-medium transition"
          >
            + Thêm mặt hàng
          </button>
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
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            rows={2}
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

        <Button variant="primary" onClick={handleSubmit} loading={submitting}>
          Ghi phiếu xuất ({lines.length} dòng)
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
  result: IssueSlipResult;
  items: IssueSlipItemView[];
  recentSlips: IssueSlipRow[];
  onNew: () => void;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title="Phiếu Xuất Kho" subtitle="Ghi nhận hao hụt, hư hỏng, hoặc dùng nội bộ cho hàng mua vào." />
      <Alert variant="success" title={`Đã ghi phiếu ${result.slipId} (${result.lines.length} dòng)`}>
        <div className="space-y-1">
          {result.lines.map(line => {
            const itemName = items.find(i => i.id === line.purchasedItemId)?.name ?? line.purchasedItemId;
            return (
              <div key={line.issueId}>
                Xuất {formatNumber(line.baseQuantity)} cho {itemName}. Tồn còn lại (tính tới thời điểm xuất): {formatNumber(line.onHandAfter)}.
              </div>
            );
          })}
        </div>
      </Alert>
      <Button variant="secondary" onClick={onNew}>Lập phiếu khác</Button>

      <RecentSlipsSection recentSlips={recentSlips} />
    </div>
  );
}

/**
 * Plan D D7b/D9, BR-INV-009 -- rows grouped by slipId (D9) so a multi-line
 * slip reads as one event, not several unrelated-looking rows. A legacy
 * row with no slipId (written before D9, or an I7 reversal) falls back to
 * its own single-row group via `row.slipId ?? row.id`. Reversal stays
 * per-line (I11): each row that is not itself a reversal, and has not
 * already been reversed, gets its own "Đảo phiếu" button.
 */
function RecentSlipsSection({ recentSlips }: { recentSlips: IssueSlipRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byKey = new Map<string, IssueSlipRow[]>();
    for (const row of recentSlips) {
      const key = row.slipId ?? row.id;
      const list = byKey.get(key) ?? [];
      list.push(row);
      byKey.set(key, list);
    }
    return Array.from(byKey.entries());
  }, [recentSlips]);

  async function handleReverse(row: IssueSlipRow) {
    const note = (reasonById[row.id] ?? "").trim();
    const approved = await confirm({
      title: `Đảo dòng ${row.id}?`,
      message:
        "Dòng gốc được giữ nguyên, không xoá. Một dòng bù sẽ được ghi hôm nay, theo giá bình quân hiện tại " +
        "(BR-INV-009) -- không phải giá của dòng gốc. Các dòng khác cùng phiếu không bị ảnh hưởng.",
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
      <div className="space-y-4 text-sm">
        {groups.map(([groupKey, rows]) => (
          <div key={groupKey} className="border-b border-border pb-3 last:border-0">
            <div className="text-xs text-text-muted mb-1.5">
              {rows[0].slipId ?? "(phiếu cũ)"} &middot; {formatDateTime(rows[0].issuedAt)}
              {rows[0].note && ` · ${rows[0].note}`}
            </div>
            <div className="space-y-2">
              {rows.map(row => {
                const isReversal = row.reversesIssueId !== null;
                const alreadyReversed = row.reversedByIssueId !== null;
                return (
                  <div key={row.id} className="pl-3 border-l-2 border-border/60">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="font-medium text-text-primary">{row.itemName}</span>{" "}
                        <span className={row.baseQuantity < 0 ? "text-success" : "text-text-secondary"}>
                          {row.baseQuantity > 0 ? "-" : "+"}{formatNumber(Math.abs(row.baseQuantity))}
                        </span>
                        {isReversal && <span className="ml-2 text-xs text-warning">Đảo dòng {row.reversesIssueId}</span>}
                        {alreadyReversed && <span className="ml-2 text-xs text-success">Đã đảo bởi {row.reversedByIssueId}</span>}
                      </div>
                      {!isReversal && !alreadyReversed && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleReverse(row)}
                          loading={isPending && reversingId === row.id}
                        >
                          Đảo dòng
                        </Button>
                      )}
                    </div>
                    {!isReversal && !alreadyReversed && (
                      <input
                        type="text"
                        placeholder="Lý do đảo (không bắt buộc)"
                        value={reasonById[row.id] ?? ""}
                        onChange={e => setReasonById(prev => ({ ...prev, [row.id]: e.target.value }))}
                        className="mt-1 w-full border border-border rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
