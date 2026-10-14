"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
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
import { alert, confirm } from "@/lib/shared/dialog";
import type { StocktakeApplyResult } from "@/lib/stock/stocktake-transaction";
import {
  cancelStocktakeSession,
  getStocktakeConfirmPreview,
  confirmStocktakeSession,
  type StocktakeSessionView,
} from "../actions";
import { AppliedSessionView } from "./StocktakeSessionPanels";
import { PackageLineCard, LegacyLineCard } from "./StocktakeLineCards";

export function ActiveSessionView({ session }: { session: StocktakeSessionView }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<StocktakeApplyResult | null>(null);
  const [applied, setApplied] = useState<StocktakeApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countedCount = session.lines.filter(l => l.countedQty !== null).length;
  const isPreviewing = preview !== null;
  // Plan D C6: closing with unconfirmed purchased items is allowed -- it is
  // exactly S2, that ingredient is left untouched -- but the owner must see
  // which ones by name, not discover it silently.
  const unconfirmedLines = session.lines.filter(l => l.countedQty === null);
  // BR-INV-017: counted lines whose book figure changed between the count and
  // the confirmation (a slip or order dated before the count, entered after it).
  const recomputedDiffs = (preview?.recomputedLines ?? []).filter(
    l => l.frozenQty !== l.recomputedQty,
  );

  async function handlePreview() {
    setPreviewLoading(true);
    setError(null);
    const res = await getStocktakeConfirmPreview(session.id);
    setPreviewLoading(false);
    if (res.error || !res.preview) {
      setError(res.error || "Không thể tạo bản xem trước kiểm kê");
      return;
    }
    setPreview(res.preview);
  }

  async function handleApply() {
    const approved = await confirm({
      title: "Xác nhận áp dụng kiểm kê",
      message: `Hệ thống sẽ ghi ${preview?.ledgerCount || 0} điều chỉnh sổ kho và ${preview?.issueCount || 0} dòng xuất kho. Thao tác này không thể hoàn tác tự động.`,
      variant: "warning",
    });
    if (!approved) return;

    setApplying(true);
    setError(null);
    const res = await confirmStocktakeSession(session.id, preview?.planHash || "");
    setApplying(false);
    if (res.error || !res.result) {
      setError(res.error || "Không thể áp dụng kiểm kê");
      return;
    }
    setApplied(res.result);
  }

  async function handleCancel() {
    const confirmed = await confirm({
      title: "Huỷ phiên kiểm kê",
      message: "Toàn bộ số liệu đã đếm trong phiên này sẽ bị huỷ. Bạn có chắc chắn?",
      variant: "danger",
    });
    if (!confirmed) return;
    setCancelling(true);
    // section A4b: the action's result was discarded -- a refusal failed in
    // total silence.
    const res = await cancelStocktakeSession(session.id);
    setCancelling(false);
    if (res?.error) {
      await alert({ title: "Không huỷ được", message: res.error, variant: "danger" });
      return;
    }
    // section B: session is a server-fetched prop -- without this, the
    // cancelled session's "in progress" view stays on screen until the
    // owner navigates away and back.
    router.refresh();
  }

  if (applied) {
    return <AppliedSessionView sessionId={session.id} result={applied} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kiểm kê"
        subtitle="Đếm thực tế toàn bộ nguyên liệu và bán thành phẩm, so sánh với sổ sách hệ thống."
        actions={
          <div className="flex gap-2">
            <Button
              variant={preview ? "secondary" : "primary"}
              onClick={handlePreview}
              loading={previewLoading}
            >
              Xác nhận và áp dụng
            </Button>
            <Button
              variant="delete"
              onClick={handleCancel}
              loading={cancelling}
            >
              Huỷ phiên
            </Button>
          </div>
        }
      />
      {error && <Alert variant="danger">{error}</Alert>}
      <Alert variant="warning" title={`Đang kiểm kê: ${session.id}`}>
        Bắt đầu bởi {session.createdByName} lúc {formatDateTimeFull(session.createdAt)}.
        Đã đếm {countedCount}/{session.lines.length} mặt hàng.
        {session.notes && <div className="mt-1 italic">Ghi chú: {session.notes}</div>}
      </Alert>

      {/* M4: standing at a shelf partway through a 50+ item list, the top
          banner scrolls out of view -- this stays pinned so "where did I
          stop" never requires scrolling back up. position: fixed is safe
          here: no ancestor between this and the viewport applies a
          transform, so it anchors to the real viewport, not a scroll
          container. Bottom offset respects the phone's own safe area
          (gesture bar), same convention app/admin/layout.tsx already uses. */}
      {!isPreviewing && session.lines.length > 0 && (
        <div
          className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 bg-surface-card border border-border rounded-full shadow-lg px-4 py-2 text-sm font-bold text-text-primary"
          aria-live="polite"
        >
          Đã đếm {countedCount}/{session.lines.length}
        </div>
      )}

      {preview && (
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-5 space-y-4">
          <Alert variant="warning" title="Dự kiến áp dụng">
            {preview.ledgerCount === 0 && preview.issueCount === 0
              ? "Không có chênh lệch cần điều chỉnh. Xác nhận để khoá phiên kiểm kê."
              : `Sẽ ghi ${preview.ledgerCount} điều chỉnh sổ kho và ${preview.issueCount} dòng xuất kho (kiểm kê). Chênh lệch được giữ theo thời điểm từng mặt hàng được đếm, nên các giao dịch phát sinh sau đó vẫn được bảo toàn.`}
          </Alert>
          {recomputedDiffs.length > 0 && (
            <Alert variant="info" title="Số trên sổ đã tính lại theo giờ đếm">
              <p>Có phiếu nhập hoặc phiếu xuất ghi ngày trước giờ đếm nhưng nhập sau, nên số trên sổ lúc đếm đã được tính lại.</p>
              <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                {recomputedDiffs.map(rec => {
                  const line = session.lines.find(candidate => candidate.id === rec.lineId);
                  const unitName = line?.unitName || "";
                  const displayName = line?.itemName || rec.itemReference;
                  return (
                    <li key={rec.lineId || rec.itemReference}>
                      {displayName}: {formatNumber(rec.frozenQty)} → {formatNumber(rec.recomputedQty)}{unitName ? ` ${unitName}` : ""}
                    </li>
                  );
                })}
              </ul>
            </Alert>
          )}
          {unconfirmedLines.length > 0 && (
            <Alert variant="danger" title={`${unconfirmedLines.length} mặt hàng chưa xác nhận`}>
              Những mặt hàng sau sẽ giữ nguyên tồn kho hiện tại, không bị đụng tới:{" "}
              {unconfirmedLines.map(l => l.itemName).join(", ")}.
            </Alert>
          )}
          {preview.rows.length > 0 && (
            <>
              {/* M1: a table needs a sideways scroll on a phone even with
                  overflow-x-auto -- that is not readable one-handed at a
                  shelf. Desktop keeps the table; a phone gets one card per
                  row instead, same data, no horizontal scroll. */}
              <div className="hidden md:block">
                <Table aria-label="Dự kiến áp dụng kiểm kê">
                  <TableHead>
                    <TableHeaderCell>Mặt hàng</TableHeaderCell>
                    <TableHeaderCell>Tồn hiện tại</TableHeaderCell>
                    <TableHeaderCell>Điều chỉnh</TableHeaderCell>
                    <TableHeaderCell>Dự kiến sau áp dụng</TableHeaderCell>
                  </TableHead>
                  <TableBody>
                    {preview.rows.map(row => {
                      const line = session.lines.find(candidate => candidate.id === row.lineId);
                      const unitName = line?.unitName || "";
                      // D5's ingredient-correction rows (item_type BASE_INGREDIENT,
                      // synthesized from an aggregate, not a real session line)
                      // carry no lineId -- fall back to the ingredient reference.
                      const displayName = line?.itemName || row.itemReference;
                      return (
                        <TableRow key={row.lineId || row.itemReference}>
                          <TableCell>{displayName}</TableCell>
                          <TableCell align="right">{formatNumber(row.currentTheoreticalQty)} {unitName}</TableCell>
                          <TableCell align="right">
                            <span className={row.countVariance > 0 ? "text-success" : "text-danger"}>
                              {row.countVariance > 0 ? "+" : ""}{formatNumber(row.countVariance)} {unitName}
                            </span>
                          </TableCell>
                          <TableCell align="right">{formatNumber(row.projectedQty)} {unitName}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-2">
                {preview.rows.map(row => {
                  const line = session.lines.find(candidate => candidate.id === row.lineId);
                  const unitName = line?.unitName || "";
                  const displayName = line?.itemName || row.itemReference;
                  return (
                    <div key={row.lineId || row.itemReference} className="border border-border rounded-lg p-3">
                      <div className="font-medium text-text-primary mb-1.5">{displayName}</div>
                      <div className="flex justify-between text-xs text-text-secondary">
                        <span>Tồn hiện tại: {formatNumber(row.currentTheoreticalQty)} {unitName}</span>
                        <span className={row.countVariance > 0 ? "text-success" : "text-danger"}>
                          {row.countVariance > 0 ? "+" : ""}{formatNumber(row.countVariance)} {unitName}
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        Dự kiến sau áp dụng: <span className="text-text-primary">{formatNumber(row.projectedQty)} {unitName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={applying}>
              Quay lại chỉnh sửa
            </Button>
            <Button variant="primary" onClick={handleApply} loading={applying}>
              Xác nhận áp dụng
            </Button>
          </div>
        </div>
      )}

      {session.lines.length === 0 ? (
        <EmptyState icon="📋" title="Không có mặt hàng nào" description="Không tìm thấy nguyên liệu/bán thành phẩm nào để kiểm kê." />
      ) : (
        <div className="space-y-3">
          {session.lines.map(line =>
            line.packageLines.length > 0
              ? <PackageLineCard key={line.id} line={line} disabled={isPreviewing} />
              : <LegacyLineCard key={line.id} line={line} disabled={isPreviewing} />,
          )}
        </div>
      )}
    </div>
  );
}
