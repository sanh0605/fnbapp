"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatNumber } from "@/lib/shared/format";
import { cancelIssueSlip } from "@/app/admin/inventory/issue-slips/actions";
import type { IssueSlipDetail } from "@/lib/stock/issue-slip-detail";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Alert";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableTotalRow,
} from "@/components/ui/Table";

interface CancelIssueSlipFormProps {
  detail: IssueSlipDetail;
  detailHref: string;
}

export function CancelIssueSlipForm({ detail, detailHref }: CancelIssueSlipFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const isCancelled = !!detail.cancellation;
  const isLocked = !!detail.lock;
  const cannotCancel = isCancelled || isLocked;

  const blockedReason = isCancelled
    ? (detail.cancellation?.reason ? `Phiếu đã huỷ: ${detail.cancellation.reason}` : "Phiếu đã huỷ rồi.")
    : isLocked
    ? `Phiếu nằm trước lần kiểm kê ngày ${detail.lock!.dateText} nên không sửa được. Sai lệch sẽ được bù ở lần kiểm kê sau.`
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setServerError(null);

    try {
      const res = await cancelIssueSlip({ slipId: detail.id, reason: reason.trim() });
      if (res.success || !res.error) {
        router.push(detailHref);
        router.refresh();
      } else {
        setServerError(res.error || "Có lỗi xảy ra khi huỷ phiếu");
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Có lỗi xảy ra khi huỷ phiếu";
      setServerError(msg);
      setIsSubmitting(false);
    }
  }

  const linesSummary = (
    <div className="bg-surface-card rounded-xl shadow-sm border border-border overflow-hidden">
      <div className="p-4 border-b border-border bg-surface-secondary/50">
        <h2 className="font-semibold text-text-primary">Hàng trong phiếu</h2>
      </div>

      {detail.lines.length === 0 ? (
        <div className="p-6 text-center text-text-muted">Phiếu không có dòng nào.</div>
      ) : (
        <>
          {/* Desktop Table (hidden below lg) */}
          <div className="hidden lg:block overflow-x-auto" data-testid="desktop-lines-table">
            <Table>
              <TableHead>
                <TableHeaderCell>Mặt hàng</TableHeaderCell>
                <TableHeaderCell>Số lượng</TableHeaderCell>
                <TableHeaderCell>Giá trị</TableHeaderCell>
              </TableHead>
              <TableBody>
                {detail.lines.map((line) => (
                  <TableRow key={line.issueId}>
                    <TableCell>{line.name}</TableCell>
                    <TableCell align="right">{line.quantityText}</TableCell>
                    <TableCell align="right">{formatNumber(line.value)}đ</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableTotalRow>
                <TableCell>Tổng giá trị</TableCell>
                <TableCell />
                <TableCell align="right">{formatNumber(detail.totalValue)}đ</TableCell>
              </TableTotalRow>
            </Table>
          </div>

          {/* Phone Cards (lg:hidden) */}
          <div className="p-4 space-y-3 lg:hidden" data-testid="phone-lines-list">
            {detail.lines.map((line) => (
              <div
                key={line.issueId}
                className="p-3 rounded-lg border border-border bg-surface-card flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-text-primary break-words">{line.name}</p>
                  <p className="text-xs text-text-muted">{line.quantityText}</p>
                </div>
                <div className="text-right font-medium text-text-primary whitespace-nowrap">
                  {formatNumber(line.value)}đ
                </div>
              </div>
            ))}
            <div className="p-3 rounded-lg bg-surface-secondary flex items-center justify-between font-medium text-sm">
              <span>Tổng giá trị</span>
              <span>{formatNumber(detail.totalValue)}đ</span>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (cannotCancel) {
    return (
      <div className="w-full flex flex-col gap-6 lg:grid lg:grid-cols-3">
        {/* Left Column on Desktop / 1st on Phone */}
        <div className="lg:col-span-2 space-y-6">{linesSummary}</div>

        {/* Right Column on Desktop / 2nd on Phone */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-surface-card rounded-xl shadow-sm border border-border p-5 space-y-3">
            <h2 className="font-semibold text-text-primary text-base">Phiếu này không huỷ được</h2>
            <p className="text-sm text-text-secondary leading-relaxed">{blockedReason}</p>
            <div className="pt-2">
              <Button href={detailHref} variant="secondary" className="w-full">
                Quay lại
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6 lg:grid lg:grid-cols-3">
      {/* Left Column on Desktop / 1st on Phone */}
      <div className="lg:col-span-2 space-y-6">{linesSummary}</div>

      {/* Right Column on Desktop / 2nd on Phone */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-surface-card rounded-xl shadow-sm border border-border p-5 space-y-4">
          <p className="text-text-secondary text-sm">
            Toàn bộ các dòng còn hiệu lực được trả về kho hôm nay.
          </p>

          <div className="space-y-1.5">
            <Field label="Lý do huỷ" htmlFor="cancel-reason" required>
              <textarea
                id="cancel-reason"
                aria-label="Lý do huỷ (bắt buộc)"
                rows={4}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: ghi nhầm, hàng chưa dùng"
                className="w-full border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card text-text-primary resize-y"
              />
            </Field>
            <div className="text-right text-xs text-text-muted">
              {reason.length}/500
            </div>
          </div>

          {serverError && <Alert variant="danger">{serverError}</Alert>}

          <div className="space-y-2 pt-2">
            <Button
              type="submit"
              variant="danger"
              loading={isSubmitting}
              disabled={!reason.trim() || isSubmitting}
              className="w-full"
            >
              Xác nhận huỷ
            </Button>
            <Button href={detailHref} variant="secondary" className="w-full">
              Quay lại
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

export default CancelIssueSlipForm;
