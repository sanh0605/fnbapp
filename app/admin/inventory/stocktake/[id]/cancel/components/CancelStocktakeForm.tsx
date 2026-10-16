"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Alert variant="warning" title="Xác nhận hoàn tác phiên kiểm kê">
        Số liệu đã đếm được giữ nguyên, không xoá. Toàn bộ điều chỉnh tồn kho phiên này đã ghi sẽ được
        đảo ngược lại hôm nay, theo giá bình quân hiện tại (BR-INV-009). Thao tác này chỉ Chủ quán
        mới thực hiện được.
      </Alert>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Lines with differences */}
        <div className="lg:col-span-2 space-y-4">
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
                {/* Desktop Table */}
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
                              <span className="tabular-nums">
                                {formatNumber(line.theoreticalAtCount)}
                              </span>
                            </TableCell>
                            <TableCell align="right">
                              <span className="tabular-nums">
                                {formatNumber(line.countedQty)}
                              </span>
                            </TableCell>
                            <TableCell align="right">
                              <span
                                className={`tabular-nums ${
                                  diff > 0 ? "text-success" : "text-danger"
                                }`}
                              >
                                {diff > 0 ? "+" : ""}
                                {formatNumber(diff)} {line.unitName}
                              </span>
                            </TableCell>
                            <TableCell align="right">
                              <span className="tabular-nums">
                                {line.diffValue !== null
                                  ? `${line.diffValue < 0 ? "-" : "+"}${formatNumber(
                                      Math.abs(line.diffValue)
                                    )}đ`
                                  : "—"}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {diffLines.map((line) => {
                    const diff = line.countedQty! - line.theoreticalAtCount!;
                    return (
                      <div
                        key={line.id}
                        className="bg-surface-secondary/40 rounded-xl p-3 text-xs space-y-1.5 border border-border"
                      >
                        <div className="font-medium text-text-primary text-sm">
                          {line.itemName}
                        </div>
                        <div className="flex justify-between text-text-secondary">
                          <span>
                            Sổ: {formatNumber(line.theoreticalAtCount)} {line.unitName}
                          </span>
                          <span>
                            Đếm: {formatNumber(line.countedQty)} {line.unitName}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-border/50">
                          <span className={diff > 0 ? "text-success" : "text-danger"}>
                            {diff > 0 ? "+" : ""}
                            {formatNumber(diff)} {line.unitName}
                          </span>
                          <span className="tabular-nums text-text-primary font-medium">
                            {line.diffValue !== null
                              ? `${line.diffValue < 0 ? "-" : "+"}${formatNumber(
                                  Math.abs(line.diffValue)
                                )}đ`
                              : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Session Info & Reason Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-surface-card rounded-2xl border border-border p-5 space-y-3 text-sm">
            <h2 className="font-semibold text-text-primary text-base">Thông tin phiên kiểm kê</h2>
            <div className="space-y-2 text-text-secondary">
              <div className="flex justify-between">
                <span>Mã phiên:</span>
                <span className="font-mono text-text-primary">{session.id}</span>
              </div>
              <div className="flex justify-between">
                <span>Người tạo:</span>
                <span className="text-text-primary">{session.createdByName}</span>
              </div>
              <div className="flex justify-between">
                <span>Thời gian:</span>
                <span className="text-text-primary tabular-nums">
                  {formatDateTimeFull(session.createdAt)}
                </span>
              </div>
              {listRow && (
                <div className="flex justify-between pt-2 border-t border-border/60">
                  <span>Giá trị lệch:</span>
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
              <div className="text-right text-[13px] text-text-muted">
                {reason.length}/500
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Button
                type="submit"
                variant="danger"
                loading={isSubmitting}
                disabled={isSubmitting}
                className="w-full"
              >
                Hoàn tác
              </Button>
              <Button
                href={detailHref}
                variant="secondary"
                className="w-full"
              >
                Quay lại
              </Button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
