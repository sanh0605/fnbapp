"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { formatNumber } from "@/lib/shared/format";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { formatStocktakeDiffValue } from "@/app/admin/inventory/stocktake/components/StocktakeList";
import { getVarianceText } from "@/app/admin/inventory/stocktake/[id]/components/StocktakeDetailView";
import {
  reverseConfirmedStocktakeSession,
  type StocktakeSessionView,
  type StocktakeListRow,
} from "../../../actions";

interface CancelStocktakeFormProps {
  session: StocktakeSessionView;
  listRow?: StocktakeListRow;
}

export function CancelStocktakeForm({ session, listRow }: CancelStocktakeFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const detailHref = `/admin/inventory/stocktake/${session.id}`;
  const diffLines = session.lines.filter(
    (l) => l.countedQty !== null && l.theoreticalAtCount !== null && l.countedQty !== l.theoreticalAtCount
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Nhập lý do hoàn tác");
      return;
    }
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const res = await reverseConfirmedStocktakeSession(session.id, trimmed);
      if (res?.error) {
        setError(res.error);
        setIsSubmitting(false);
        return;
      }
      router.push(detailHref);
      router.refresh();
    } catch {
      setError("Không thể hoàn tác phiên kiểm kê");
      setIsSubmitting(false);
    }
  }

  function formatDiffValue(line: (typeof diffLines)[0]) {
    if (line.diffValue === null) return "—";
    if (line.diffValue === 0) return "0đ";
    if (line.diffValue < 0) return `-${formatNumber(Math.abs(line.diffValue))}đ`;
    return `+${formatNumber(line.diffValue)}đ`;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Alert variant="warning" title="Xác nhận hoàn tác phiên kiểm kê">
        Số liệu đã đếm được giữ nguyên, không xoá. Toàn bộ điều chỉnh tồn kho phiên này đã ghi sẽ được
        đảo ngược lại hôm nay, theo giá bình quân hiện tại. Thao tác này chỉ Chủ quán
        mới thực hiện được.
      </Alert>

      {error && <Alert variant="danger">{error}</Alert>}

      {/* info beside reason + buttons on a computer; the page fills the frame (BR-UI-012) */}
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="bg-surface-card rounded-2xl border border-border p-5 space-y-3 text-sm">
          <h2 className="font-semibold text-text-primary text-base">Thông tin phiên kiểm kê</h2>
          <div className="space-y-2 text-text-secondary">
            <div className="flex justify-between">
              <span>Mã phiên</span>
              <span className="text-text-primary">{session.id}</span>
            </div>
            <div className="flex justify-between">
              <span>Người tạo</span>
              <span className="text-text-primary">{session.createdByName}</span>
            </div>
            <div className="flex justify-between">
              <span>Tạo lúc</span>
              <span className="text-text-primary tabular-nums">
                {formatDateTimeFull(session.createdAt) || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Xác nhận lúc</span>
              <span className="text-text-primary tabular-nums">
                {session.confirmedAt ? formatDateTimeFull(session.confirmedAt) : "—"}
              </span>
            </div>
            {listRow && (
              <div className="flex justify-between pt-2 border-t border-border/60">
                <span>Giá trị lệch</span>
                <span className="text-text-primary tabular-nums font-medium">
                  {formatStocktakeDiffValue(listRow)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface-card rounded-2xl border border-border p-5 space-y-3">
          <div className="space-y-1.5">
            <Field label="Lý do hoàn tác" htmlFor="cancel-reason" required>
              <textarea
                id="cancel-reason"
                aria-label="Lý do hoàn tác (bắt buộc)"
                rows={4}
                maxLength={500}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Ví dụ: kiểm nhầm ngày"
                className="w-full border border-border rounded-lg p-3 text-base md:text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card text-text-primary resize-y"
              />
            </Field>
            <div className="text-right text-[13px] md:text-xs text-text-muted">
              {reason.length}/500
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              href={detailHref}
              variant="secondary"
              className="flex-1 min-h-[48px] md:min-h-[40px]"
            >
              Quay lại
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={isSubmitting}
              disabled={isSubmitting}
              className="flex-1 min-h-[48px] md:min-h-[40px]"
            >
              Hoàn tác
            </Button>
          </div>
        </div>
      </div>

      {/* Lines with differences (full width below panel) */}
      <div className="bg-surface-card rounded-2xl border border-border p-5 space-y-3">
        <h2 className="font-semibold text-text-primary text-base">
          Hàng có chênh lệch trong phiên ({diffLines.length})
        </h2>

        {diffLines.length === 0 ? (
          <p className="text-text-muted text-sm py-4">
            Phiên kiểm kê này không có mặt hàng nào chênh lệch.
          </p>
        ) : (
          <>
            {/* Desktop Table Layout */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Mặt hàng</TableHeaderCell>
                  <TableHeaderCell>Đơn vị</TableHeaderCell>
                  <TableHeaderCell>Sổ lúc đếm</TableHeaderCell>
                  <TableHeaderCell>Đếm được</TableHeaderCell>
                  <TableHeaderCell>Chênh lệch</TableHeaderCell>
                  <TableHeaderCell>Giá trị lệch</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {diffLines.map((line) => {
                    const diff = line.countedQty! - line.theoreticalAtCount!;
                    return (
                      <TableRow key={line.id}>
                        <TableCell>{line.itemName}</TableCell>
                        <TableCell>{line.unitName}</TableCell>
                        <TableCell align="right">
                          <span className="tabular-nums whitespace-nowrap">
                            {formatNumber(line.theoreticalAtCount)}
                          </span>
                        </TableCell>
                        <TableCell align="right">
                          <span className="tabular-nums whitespace-nowrap">
                            {formatNumber(line.countedQty)}
                          </span>
                        </TableCell>
                        <TableCell align="right">
                          <span
                            className={`tabular-nums whitespace-nowrap ${
                              diff > 0 ? "text-success" : "text-danger"
                            }`}
                          >
                            {getVarianceText(line.countedQty, line.theoreticalAtCount, line.unitName)}
                          </span>
                        </TableCell>
                        <TableCell align="right">
                          <span className="tabular-nums whitespace-nowrap">
                            {formatDiffValue(line)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile PhoneRow Layout */}
            <div className="md:hidden divide-y divide-border">
              {diffLines.map((line) => {
                const diff = line.countedQty! - line.theoreticalAtCount!;
                return (
                  <div key={line.id} className="py-2.5">
                    <PhoneRow
                      title={line.itemName}
                      value={formatDiffValue(line)}
                      meta={
                        <span>
                          Sổ {formatNumber(line.theoreticalAtCount)} {line.unitName} · Đếm {formatNumber(line.countedQty)} {line.unitName} ·{" "}
                          <span
                            className={`whitespace-nowrap ${
                              diff > 0 ? "text-success" : "text-danger"
                            }`}
                          >
                            {getVarianceText(line.countedQty, line.theoreticalAtCount, line.unitName)}
                          </span>
                        </span>
                      }
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </form>
  );
}
