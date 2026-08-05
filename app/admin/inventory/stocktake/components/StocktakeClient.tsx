"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import { confirm } from "@/lib/dialog";
import type { StocktakeApplyResult } from "@/lib/stocktake-transaction";
import {
  startStocktakeSession,
  saveStocktakeLine,
  cancelStocktakeSession,
  getStocktakeConfirmPreview,
  confirmStocktakeSession,
  type StocktakeSessionView,
} from "../actions";

export function StocktakeClient({ session }: { session: StocktakeSessionView | null }) {
  if (!session) {
    return <StartSessionView />;
  }
  return <ActiveSessionView session={session} />;
}

function StartSessionView() {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setLoading(true);
    setError(null);
    const res = await startStocktakeSession(notes);
    setLoading(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Kiểm Kê Định Kỳ" subtitle="Đếm thực tế toàn bộ nguyên liệu và bán thành phẩm, so sánh với sổ sách hệ thống." />
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 max-w-xl mx-auto text-center space-y-4">
        <p className="text-text-secondary text-sm">
          Bắt đầu một phiên kiểm kê mới sẽ đưa toàn bộ nguyên liệu và bán thành phẩm vào danh sách đếm.
          Kết quả đếm được lưu ngay khi nhập, có thể tạm dừng và quay lại sau.
        </p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ghi chú (không bắt buộc)..."
          rows={2}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
        />
        <Button variant="primary" onClick={handleStart} loading={loading}>
          Bắt đầu kiểm kê
        </Button>
      </div>
    </div>
  );
}

function ActiveSessionView({ session }: { session: StocktakeSessionView }) {
  const [cancelling, setCancelling] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<StocktakeApplyResult | null>(null);
  const [applied, setApplied] = useState<StocktakeApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countedCount = session.lines.filter(l => l.countedQty !== null).length;
  const isPreviewing = preview !== null;

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
      title: "Hủy phiên kiểm kê",
      message: "Toàn bộ số liệu đã đếm trong phiên này sẽ bị hủy. Bạn có chắc chắn?",
      variant: "danger",
    });
    if (!confirmed) return;
    setCancelling(true);
    await cancelStocktakeSession(session.id);
    setCancelling(false);
  }

  if (applied) {
    return <AppliedSessionView sessionId={session.id} result={applied} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kiểm Kê Định Kỳ"
        subtitle="Đếm thực tế toàn bộ nguyên liệu và bán thành phẩm, so sánh với sổ sách hệ thống."
        actions={
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handlePreview} loading={previewLoading}>
              Xác nhận và áp dụng
            </Button>
            <Button variant="danger" size="sm" onClick={handleCancel} loading={cancelling}>
              Hủy phiên
            </Button>
          </div>
        }
      />
      {error && <Alert variant="danger">{error}</Alert>}
      <Alert variant="warning" title={`Đang kiểm kê: ${session.id}`}>
        Bắt đầu bởi {session.createdByName} lúc {new Date(session.createdAt).toLocaleString("vi-VN")}.
        Đã đếm {countedCount}/{session.lines.length} mặt hàng.
        {session.notes && <div className="mt-1 italic">Ghi chú: {session.notes}</div>}
      </Alert>

      {preview && (
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-5 space-y-4">
          <Alert variant="warning" title="Dự kiến áp dụng">
            {preview.ledgerCount === 0 && preview.issueCount === 0
              ? "Không có chênh lệch cần điều chỉnh. Xác nhận để khóa phiên kiểm kê."
              : `Sẽ ghi ${preview.ledgerCount} điều chỉnh sổ kho và ${preview.issueCount} dòng xuất kho (kiểm kê). Chênh lệch được giữ theo thời điểm từng mặt hàng được đếm, nên các giao dịch phát sinh sau đó vẫn được bảo toàn.`}
          </Alert>
          {preview.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary text-xs">
                    <th className="px-3 py-2">Mặt hàng</th>
                    <th className="px-3 py-2 text-right">Tồn hiện tại</th>
                    <th className="px-3 py-2 text-right">Điều chỉnh</th>
                    <th className="px-3 py-2 text-right">Dự kiến sau áp dụng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {preview.rows.map(row => {
                    const line = session.lines.find(candidate => candidate.id === row.lineId);
                    const unitName = line?.unitName || "";
                    return (
                      <tr key={row.lineId}>
                        <td className="px-3 py-2 font-medium text-text-primary">{line?.itemName || row.itemReference}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.currentTheoreticalQty)} {unitName}</td>
                        <td className={`px-3 py-2 text-right font-bold ${row.countVariance > 0 ? "text-success" : "text-danger"}`}>
                          {row.countVariance > 0 ? "+" : ""}{formatNumber(row.countVariance)} {unitName}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">{formatNumber(row.projectedQty)} {unitName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreview(null)} disabled={applying}>
              Quay lại chỉnh sửa
            </Button>
            <Button variant="warning" onClick={handleApply} loading={applying}>
              Xác nhận áp dụng
            </Button>
          </div>
        </div>
      )}

      {session.lines.length === 0 ? (
        <EmptyState icon="📋" title="Không có mặt hàng nào" description="Không tìm thấy nguyên liệu/bán thành phẩm nào để kiểm kê." />
      ) : (
        <div className="bg-surface-card rounded-card shadow-sm border border-border overflow-hidden">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-page text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                <th className="px-4 py-3 font-bold">Mặt hàng</th>
                <th className="px-4 py-3 font-bold">Loại</th>
                <th className="px-4 py-3 font-bold text-right">Số đếm thực tế</th>
                <th className="px-4 py-3 font-bold text-right">Sổ sách</th>
                <th className="px-4 py-3 font-bold text-right">Chênh lệch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {session.lines.map(line => (
                <LineRow key={line.id} line={line} disabled={isPreviewing} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AppliedSessionView({ sessionId, result }: { sessionId: string; result: StocktakeApplyResult }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Kiểm Kê Định Kỳ"
        subtitle="Phiên kiểm kê đã được xác nhận và khóa."
      />
      <Alert variant="success" title={`Đã áp dụng phiên ${sessionId}`}>
        <div>
          Đã ghi {result.ledgerCount} điều chỉnh sổ kho
          {result.issueCount > 0 ? ` và ${result.issueCount} dòng xuất kho (kiểm kê)` : ""}.
        </div>
        {result.ledgerIds.length > 0 && <div>Các mã ledger: {result.ledgerIds.join(", ")}.</div>}
        {result.issueIds.length > 0 && <div>Các mã xuất kho: {result.issueIds.join(", ")}.</div>}
        {result.ledgerIds.length === 0 && result.issueIds.length === 0 && <div>Không có điều chỉnh nào.</div>}
      </Alert>
      {result.rows.length > 0 && (
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-5">
          <h2 className="font-bold text-text-primary mb-3">Các điều chỉnh đã áp dụng</h2>
          <div className="space-y-2 text-sm">
            {result.rows.map(row => (
              <div key={row.lineId} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
                <span>{row.itemReference}</span>
                <span className={row.countVariance > 0 ? "text-success font-bold" : "text-danger font-bold"}>
                  {row.countVariance > 0 ? "+" : ""}{formatNumber(row.countVariance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LineRow({
  line,
  disabled = false,
}: {
  line: StocktakeSessionView["lines"][number];
  disabled?: boolean;
}) {
  const [inputValue, setInputValue] = useState(line.countedQty !== null ? String(line.countedQty) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCounted = line.countedQty !== null;
  const variance = isCounted && line.theoreticalAtCount !== null ? line.countedQty! - line.theoreticalAtCount : null;

  async function handleSave() {
    const qty = Number(inputValue);
    if (inputValue === "" || Number.isNaN(qty) || qty < 0) {
      setError("Số đếm không hợp lệ");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await saveStocktakeLine(line.id, qty);
    setSaving(false);
    if (res.error) setError(res.error);
  }

  return (
    <tr className="hover:bg-page transition-colors">
      <td className="px-4 py-3 font-medium text-text-primary">{line.itemName}</td>
      <td className="px-4 py-3 text-text-secondary text-xs">
        {line.itemType === "SEMI_PRODUCT"
        ? "Bán thành phẩm"
        : line.itemType === "PURCHASED_ITEM"
          ? "Hàng mua vào"
          : "Nguyên liệu"}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          {error && <span className="text-danger text-xs">{error}</span>}
          <input
            type="number"
            min="0"
            step="any"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            disabled={disabled}
            className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-focus-ring"
          />
          <span className="text-text-muted text-xs">{line.unitName}</span>
          <Button variant="secondary" size="sm" onClick={handleSave} loading={saving} disabled={disabled}>
            Lưu
          </Button>
        </div>
      </td>
      <td className="px-4 py-3 text-right text-text-secondary">
        {isCounted ? `${formatNumber(line.theoreticalAtCount)} ${line.unitName}` : "---"}
      </td>
      <td className={`px-4 py-3 text-right font-bold ${variance === null ? "text-text-muted" : variance === 0 ? "text-text-secondary" : variance > 0 ? "text-success" : "text-danger"}`}>
        {variance === null ? "---" : `${variance > 0 ? "+" : ""}${formatNumber(variance)} ${line.unitName}`}
      </td>
    </tr>
  );
}
