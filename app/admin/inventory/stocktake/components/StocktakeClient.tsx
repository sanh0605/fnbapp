"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import { formatDateTime } from "@/lib/datetime";
import { confirm } from "@/lib/dialog";
import type { StocktakeApplyResult } from "@/lib/stocktake-transaction";
import {
  startStocktakeSession,
  saveStocktakeLine,
  cancelStocktakeSession,
  getStocktakeConfirmPreview,
  confirmStocktakeSession,
  reverseConfirmedStocktakeSession,
  type StocktakeSessionView,
  type RecentConfirmedStocktakeSessionView,
} from "../actions";

export function StocktakeClient({
  session,
  lastConfirmed,
}: {
  session: StocktakeSessionView | null;
  lastConfirmed: RecentConfirmedStocktakeSessionView | null;
}) {
  return (
    <div className="space-y-6">
      {session ? <ActiveSessionView session={session} /> : <StartSessionView />}
      {lastConfirmed && <LastConfirmedSessionPanel session={lastConfirmed} />}
    </div>
  );
}

// Plan D D14, U1-U6: undo the most recently applied count. Shown regardless
// of whether a new session is OPEN -- U4 blocks the actual reversal while
// one is, but the owner should still see the last confirmed session exists,
// not have it silently disappear from the screen.
function LastConfirmedSessionPanel({ session }: { session: RecentConfirmedStocktakeSessionView }) {
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
      <h2 className="font-bold text-text-primary text-sm">Phiên kiểm kê gần nhất</h2>
      <p className="text-xs text-text-secondary">
        {session.id} &middot; áp dụng bởi {session.confirmedByName} lúc {formatDateTime(session.confirmedAt)}
        {session.notes && ` · ${session.notes}`}
      </p>
      {error && <Alert variant="danger">{error}</Alert>}
      {session.hasOpenSessionBlocking ? (
        <p className="text-xs text-warning">Đang có một phiên kiểm kê mới mở -- xử lý xong phiên đó trước khi huỷ phiên này.</p>
      ) : (
        <>
          <input
            type="text"
            placeholder="Lý do huỷ (bắt buộc)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
          />
          <Button variant="danger" onClick={handleReverse} loading={cancelling}>
            Huỷ phiên kiểm kê này
          </Button>
        </>
      )}
    </div>
  );
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
  // Plan D C6: closing with unconfirmed purchased items is allowed -- it is
  // exactly S2, that ingredient is left untouched -- but the owner must see
  // which ones by name, not discover it silently.
  const unconfirmedLines = session.lines.filter(l => l.countedQty === null);

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
            <Button variant="primary" onClick={handlePreview} loading={previewLoading}>
              Xác nhận và áp dụng
            </Button>
            <Button variant="danger" onClick={handleCancel} loading={cancelling}>
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
              ? "Không có chênh lệch cần điều chỉnh. Xác nhận để khóa phiên kiểm kê."
              : `Sẽ ghi ${preview.ledgerCount} điều chỉnh sổ kho và ${preview.issueCount} dòng xuất kho (kiểm kê). Chênh lệch được giữ theo thời điểm từng mặt hàng được đếm, nên các giao dịch phát sinh sau đó vẫn được bảo toàn.`}
          </Alert>
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
              <div className="overflow-x-auto hidden md:block">
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
                      // D5's ingredient-correction rows (item_type BASE_INGREDIENT,
                      // synthesized from an aggregate, not a real session line)
                      // carry no lineId -- fall back to the ingredient reference.
                      const displayName = line?.itemName || row.itemReference;
                      return (
                        <tr key={row.lineId || row.itemReference}>
                          <td className="px-3 py-2 font-medium text-text-primary">{displayName}</td>
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
                        <span className={`font-bold ${row.countVariance > 0 ? "text-success" : "text-danger"}`}>
                          {row.countVariance > 0 ? "+" : ""}{formatNumber(row.countVariance)} {unitName}
                        </span>
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        Dự kiến sau áp dụng: <span className="font-semibold text-text-primary">{formatNumber(row.projectedQty)} {unitName}</span>
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
            <Button variant="warning" onClick={handleApply} loading={applying}>
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

/**
 * Plan D D6 -- one purchased item, one integer input per ACTIVE package
 * size (lib/stocktake-package-lines.ts, reused from D3, not regenerated
 * here). C6: confirmation happens once per purchased item, not per
 * conversion line and not per ingredient -- a single "Xác nhận" commits
 * every conversion's value as one summed base-unit count.
 */
function PackageLineCard({
  line,
  disabled = false,
}: {
  line: StocktakeSessionView["lines"][number];
  disabled?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  // Confirmed reflects the SERVER's last saved count, not local input state
  // -- true only immediately after a successful save, and cleared the
  // moment any input changes afterward (C6: editing clears confirmation).
  const [confirmed, setConfirmed] = useState(line.countedQty !== null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCounted = line.countedQty !== null;
  const variance = isCounted && line.theoreticalAtCount !== null ? line.countedQty! - line.theoreticalAtCount : null;

  function handleInputChange(conversionId: string, raw: string) {
    setValues(prev => ({ ...prev, [conversionId]: raw }));
    setConfirmed(false);
    setError(null);
  }

  async function handleConfirm() {
    // BR-INV-007: only whole sealed packages are counted -- reject a
    // decimal with the reason, rather than rounding it silently.
    let sumBaseQty = 0;
    for (const pkg of line.packageLines) {
      const raw = values[pkg.conversionId];
      if (raw === undefined || raw.trim() === "") continue;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError(`Số lượng "${pkg.sizeLabel}" không hợp lệ.`);
        return;
      }
      if (!Number.isInteger(parsed)) {
        setError(
          `"${pkg.sizeLabel}": chỉ nhập số nguyên gói còn nguyên seal (quy tắc BR-INV-007) -- không ước lượng phần lẻ.`,
        );
        return;
      }
      sumBaseQty += parsed * pkg.conversionRate;
    }

    setSaving(true);
    setError(null);
    const res = await saveStocktakeLine(line.id, sumBaseQty);
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setConfirmed(true);
  }

  return (
    <div className={`bg-surface-card rounded-card shadow-sm border p-4 ${confirmed ? "border-success" : "border-border"}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-medium text-text-primary">{line.itemName}</span>
          <span className="ml-2 text-text-secondary text-xs">Hàng mua vào</span>
        </div>
        {confirmed ? (
          <span className="text-success text-xs font-bold flex items-center gap-1">✓ Đã xác nhận</span>
        ) : isCounted ? (
          <span className="text-warning text-xs font-bold">Đã sửa, chưa xác nhận lại</span>
        ) : (
          <span className="text-text-muted text-xs">Chưa xác nhận</span>
        )}
      </div>

      {/* M1: one package size per row on a phone, not two crammed side by
          side -- "mỗi dòng quy cách một thẻ, xếp dọc". Expands from sm:
          up, where there is room to spare. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        {line.packageLines.map(pkg => (
          <label key={pkg.conversionId} className="flex flex-col gap-1">
            <span className="text-xs text-text-secondary">{pkg.sizeLabel}</span>
            <input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              placeholder="0"
              value={values[pkg.conversionId] ?? ""}
              onChange={e => handleInputChange(pkg.conversionId, e.target.value)}
              disabled={disabled}
              className="border border-border rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-focus-ring"
            />
          </label>
        ))}
      </div>

      {error && <div className="text-danger text-xs mb-2">{error}</div>}

      <div className="flex items-center justify-between">
        <div className="text-xs text-text-secondary">
          {isCounted && line.theoreticalAtCount !== null && (
            <>
              Sổ sách: {formatNumber(line.theoreticalAtCount)} {line.unitName}
              {variance !== null && (
                <span className={`ml-2 font-bold ${variance === 0 ? "text-text-secondary" : variance > 0 ? "text-success" : "text-danger"}`}>
                  {variance > 0 ? "+" : ""}{formatNumber(variance)} {line.unitName}
                </span>
              )}
            </>
          )}
        </div>
        {/* M3: this is the button tapped most often in the whole screen --
            one per purchased item, standing at the shelf -- so it gets a
            full 44px thumb target (Button's default md size), not sm's 32px. */}
        <Button variant={confirmed ? "secondary" : "primary"} onClick={handleConfirm} loading={saving} disabled={disabled}>
          Xác nhận
        </Button>
      </div>
    </div>
  );
}

/**
 * Legacy path, unchanged behaviour: a BASE_INGREDIENT line that survives
 * from a session opened before D4/D6 (C8/C16 -- an already-open session
 * keeps its lines regardless of what a new session would offer). Has no
 * package lines to render, so it keeps the old single base-unit input.
 */
function LegacyLineCard({
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
    <div className="bg-surface-card rounded-card shadow-sm border border-border p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <span className="font-medium text-text-primary">{line.itemName}</span>
          <span className="ml-2 text-text-secondary text-xs">
            {line.itemType === "SEMI_PRODUCT" ? "Bán thành phẩm" : "Nguyên liệu"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-danger text-xs">{error}</span>}
          <input
            type="number"
            min="0"
            step="any"
            // M2: decimal, not numeric -- this field allows fractional
            // quantities (step="any", unlike PackageLineCard's whole-
            // package-only inputs), and inputMode="numeric" hides the
            // decimal point on most phone keypads. "decimal" opens a
            // number pad that still has one.
            inputMode="decimal"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            disabled={disabled}
            className="w-24 border border-border rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-focus-ring"
          />
          <span className="text-text-muted text-xs">{line.unitName}</span>
          <Button variant="secondary" onClick={handleSave} loading={saving} disabled={disabled}>
            Lưu
          </Button>
        </div>
      </div>
      <div className="mt-2 text-xs text-text-secondary">
        {isCounted ? (
          <>
            Sổ sách: {formatNumber(line.theoreticalAtCount)} {line.unitName}
            {variance !== null && (
              <span className={`ml-2 font-bold ${variance === 0 ? "text-text-secondary" : variance > 0 ? "text-success" : "text-danger"}`}>
                {variance > 0 ? "+" : ""}{formatNumber(variance)} {line.unitName}
              </span>
            )}
          </>
        ) : "---"}
      </div>
    </div>
  );
}
