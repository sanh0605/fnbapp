"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { formatNumber } from "@/lib/shared/format";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { confirm } from "@/lib/shared/dialog";
import type { StocktakeApplyResult } from "@/lib/stock/stocktake-transaction";
import {
  startStocktakeSession,
  reverseConfirmedStocktakeSession,
  type RecentConfirmedStocktakeSessionView,
} from "../actions";

// Plan D D14, U1-U6: undo the most recently applied count. Shown regardless
// of whether a new session is OPEN -- U4 blocks the actual reversal while
// one is, but the owner should still see the last confirmed session exists,
// not have it silently disappear from the screen.
export function LastConfirmedSessionPanel({ session }: { session: RecentConfirmedStocktakeSessionView }) {
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleReverse() {
    if (!reason.trim()) {
      setError("Nhập lý do trước khi huỷ phiên kiểm kê");
      return;
    }
    const approved = await confirm({
      title: `Huỷ phiên kiểm kê ${session.id}?`,
      message:
        "Số liệu đã đếm được giữ nguyên, không xoá. Toàn bộ điều chỉnh tồn kho phiên này đã ghi sẽ được đảo " +
        "ngược lại hôm nay, theo giá bình quân hiện tại (BR-INV-009). Chỉ Chủ quán mới thực hiện được thao tác này.",
      variant: "danger",
    });
    if (!approved) return;

    setError(null);
    setCancelling(true);
    const res = await reverseConfirmedStocktakeSession(session.id, reason.trim());
    setCancelling(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone(true);
  }

  if (done) return null;

  return (
    <div className="bg-surface-card rounded-card shadow-sm border border-border p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-text-primary text-sm">Phiên kiểm kê gần nhất</h2>
        <Button href={`/admin/inventory/stocktake/${session.id}`} variant="secondary">
          Xem phiếu
        </Button>
      </div>
      <p className="text-xs text-text-secondary">
        {session.id} &middot; áp dụng bởi {session.confirmedByName} lúc {formatDateTimeFull(session.confirmedAt)}
        {session.notes && ` · ${session.notes}`}
      </p>
      {error && <Alert variant="danger">{error}</Alert>}
      {session.hasOpenSessionBlocking ? (
        <p className="text-xs text-warning">Đang có một phiên kiểm kê mới mở -- xử lý xong phiên đó trước khi huỷ phiên này.</p>
      ) : (
        <>
          <TextInput
            aria-label="Lý do huỷ (bắt buộc)"
            placeholder="Ví dụ: nhập trùng phiếu"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <Button variant="delete" onClick={handleReverse} loading={cancelling}>
            Huỷ phiên kiểm kê này
          </Button>
        </>
      )}
    </div>
  );
}

export function StartSessionView() {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // section B: found while checking this screen for the same bug the owner
  // hit elsewhere -- session is a server-fetched prop, so a successful
  // start left this view showing "Bắt đầu kiểm kê" instead of switching to
  // the new session, until the owner navigated away and back.
  async function handleStart() {
    setLoading(true);
    setError(null);
    const res = await startStocktakeSession(notes);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Kiểm kê" subtitle="Đếm thực tế toàn bộ nguyên liệu và bán thành phẩm, so sánh với sổ sách hệ thống." />
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="bg-surface-card rounded-card shadow-sm border border-border p-6 max-w-xl mx-auto text-center space-y-4">
        <p className="text-text-secondary text-sm">
          Bắt đầu một phiên kiểm kê mới sẽ đưa toàn bộ nguyên liệu và bán thành phẩm vào danh sách đếm.
          Kết quả đếm được lưu ngay khi nhập, có thể tạm dừng và quay lại sau.
        </p>
        <textarea
          aria-label="Ghi chú (không bắt buộc)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Ví dụ: kiểm cuối tháng"
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

export function AppliedSessionView({ sessionId, result }: { sessionId: string; result: StocktakeApplyResult }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Kiểm kê"
        subtitle="Phiên kiểm kê đã được xác nhận và khoá."
      />
      <Alert variant="success" title={`Đã áp dụng phiên ${sessionId}`}>
        <div>
          {result.issueCount > 0 ? `Đã ghi ${result.issueCount} dòng xuất kho (kiểm kê)` : "Không có dòng xuất kho nào"}
          {result.ledgerCount > 0 ? `, và phát hiện ${result.ledgerCount} điều chỉnh nguyên liệu (xem bảng bên dưới)` : ""}.
        </div>
        {result.issueIds.length > 0 && <div>Các mã xuất kho: {result.issueIds.join(", ")}.</div>}
        {result.ledgerCount === 0 && result.issueIds.length === 0 && <div>Không có điều chỉnh nào.</div>}
      </Alert>
      {result.rows.length > 0 && (
        <div className="bg-surface-card rounded-card shadow-sm border border-border p-5">
          <h2 className="font-bold text-text-primary mb-3">Các điều chỉnh đã áp dụng</h2>
          <div className="space-y-2 text-sm">
            {result.rows.map(row => (
              <div key={row.lineId || row.itemReference} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
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
