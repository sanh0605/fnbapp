"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import { confirm } from "@/lib/dialog";
import {
  startStocktakeSession,
  saveStocktakeLine,
  cancelStocktakeSession,
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

  const countedCount = session.lines.filter(l => l.countedQty !== null).length;

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kiểm Kê Định Kỳ"
        subtitle="Đếm thực tế toàn bộ nguyên liệu và bán thành phẩm, so sánh với sổ sách hệ thống."
        actions={
          <Button variant="danger" size="sm" onClick={handleCancel} loading={cancelling}>
            Hủy phiên
          </Button>
        }
      />
      <Alert variant="warning" title={`Đang kiểm kê: ${session.id}`}>
        Bắt đầu bởi {session.createdByName} lúc {new Date(session.createdAt).toLocaleString("vi-VN")}.
        Đã đếm {countedCount}/{session.lines.length} mặt hàng.
        {session.notes && <div className="mt-1 italic">Ghi chú: {session.notes}</div>}
      </Alert>

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
                <LineRow key={line.id} line={line} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LineRow({ line }: { line: StocktakeSessionView["lines"][number] }) {
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
        {line.itemType === "SEMI_PRODUCT" ? "Bán thành phẩm" : "Nguyên liệu"}
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
            className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-focus-ring"
          />
          <span className="text-text-muted text-xs">{line.unitName}</span>
          <Button variant="secondary" size="sm" onClick={handleSave} loading={saving}>
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
