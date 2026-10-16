"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { TextInput } from "@/components/ui/TextInput";
import { NumberInput } from "@/components/ui/NumberInput";
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
import { useStocktakeLinesFilter } from "./useStocktakeLinesFilter";
import type { StocktakeApplyResult } from "@/lib/stock/stocktake-transaction";
import {
  saveStocktakeLine,
  cancelStocktakeSession,
  getStocktakeConfirmPreview,
  confirmStocktakeSession,
  type StocktakeSessionView,
  type StocktakeLineView,
} from "../../actions";

interface StocktakeCountViewProps {
  session: StocktakeSessionView;
}

export function StocktakeCountView({ session }: StocktakeCountViewProps) {
  const router = useRouter();

  const [lines, setLines] = useState<StocktakeLineView[]>(session.lines);

  const hasBlankInitial = useMemo(() => session.lines.some((l) => l.state === "BLANK"), [session.lines]);
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    allCount,
    blankCount,
    offCount,
    matchCount,
    filteredLines,
    groups,
  } = useStocktakeLinesFilter(lines, hasBlankInitial ? "BLANK" : "ALL");

  // Per-line package card inputs & save state
  const [packageInputs, setPackageInputs] = useState<Record<string, Record<string, string>>>({});
  const [legacyInputs, setLegacyInputs] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      session.lines
        .filter((l) => l.packageLines.length === 0 && l.countedQty !== null)
        .map((l) => [l.id, String(l.countedQty)])
    )
  );
  const [savingLineId, setSavingLineId] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});
  const [confirmedLines, setConfirmedLines] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      session.lines.filter((l) => l.countedQty !== null).map((l) => [l.id, true])
    )
  );

  // Session cancel state
  const [confirmingCancelInline, setConfirmingCancelInline] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Preview & Confirm state
  const [preview, setPreview] = useState<StocktakeApplyResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmingApplyInline, setConfirmingApplyInline] = useState(false);
  const [applying, setApplying] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Provisional difference calculation for footer
  const provisionalSummary = useMemo(() => {
    let shortTotal = 0;
    let foundTotal = 0;
    for (const l of lines) {
      if (l.countedQty === null || l.theoreticalAtCount === null || l.unitCost === null) continue;
      const diff = (l.countedQty - l.theoreticalAtCount) * l.unitCost;
      if (diff < 0) {
        shortTotal -= diff;
      } else {
        foundTotal += diff;
      }
    }
    const shortVal = Math.round(shortTotal);
    const foundVal = Math.round(foundTotal);

    if (shortVal > 0 && foundVal > 0) {
      return `Tạm tính: thiếu ${formatNumber(shortVal)}đ · thừa ${formatNumber(foundVal)}đ`;
    }
    if (shortVal > 0) {
      return `Tạm tính: thiếu ${formatNumber(shortVal)}đ`;
    }
    if (foundVal > 0) {
      return `Tạm tính: thừa ${formatNumber(foundVal)}đ`;
    }
    return "Tạm tính: 0đ";
  }, [lines]);

  // Save a package-based line
  async function handleSavePackageLine(line: StocktakeLineView) {
    const lineValues = packageInputs[line.id] || {};
    let sumBaseQty = 0;
    let anyFilled = false;
    for (const pkg of line.packageLines) {
      const raw = lineValues[pkg.conversionId];
      if (raw === undefined || raw.trim() === "") continue;
      anyFilled = true;
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed < 0) {
        setLineErrors((prev) => ({
          ...prev,
          [line.id]: `Số lượng "${pkg.sizeLabel}" không hợp lệ.`,
        }));
        return;
      }
      if (!Number.isInteger(parsed)) {
        setLineErrors((prev) => ({
          ...prev,
          [line.id]: `"${pkg.sizeLabel}": chỉ nhập số nguyên gói còn nguyên seal (quy tắc BR-INV-007) -- không ước lượng phần lẻ.`,
        }));
        return;
      }
      sumBaseQty += parsed * pkg.conversionRate;
    }

    if (!anyFilled) {
      setLineErrors((prev) => ({ ...prev, [line.id]: "Cần nhập số đếm" }));
      return;
    }

    setSavingLineId(line.id);
    setLineErrors((prev) => ({ ...prev, [line.id]: "" }));

    const res = await saveStocktakeLine(line.id, sumBaseQty);
    setSavingLineId(null);

    if (res?.error) {
      setLineErrors((prev) => ({ ...prev, [line.id]: res.error || "Lỗi lưu số đếm" }));
      return;
    }

    setConfirmedLines((prev) => ({ ...prev, [line.id]: true }));
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== line.id) return l;
        const counted = sumBaseQty;
        const book = l.theoreticalAtCount;
        const state = counted === book ? "MATCH" : "OFF";
        const diffVal =
          book !== null && l.unitCost !== null
            ? Math.round((counted - book) * l.unitCost)
            : null;
        return {
          ...l,
          countedQty: counted,
          state,
          diffValue: diffVal,
          countedAt: new Date().toISOString(),
        };
      })
    );
  }

  // Save a legacy single-input line
  async function handleSaveLegacyLine(line: StocktakeLineView) {
    const raw = legacyInputs[line.id];
    if (raw === undefined || raw.trim() === "") {
      setLineErrors((prev) => ({ ...prev, [line.id]: "Cần nhập số đếm" }));
      return;
    }
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty < 0) {
      setLineErrors((prev) => ({ ...prev, [line.id]: "Số đếm không hợp lệ" }));
      return;
    }

    setSavingLineId(line.id);
    setLineErrors((prev) => ({ ...prev, [line.id]: "" }));

    const res = await saveStocktakeLine(line.id, qty);
    setSavingLineId(null);

    if (res?.error) {
      setLineErrors((prev) => ({ ...prev, [line.id]: res.error || "Lỗi lưu số đếm" }));
      return;
    }

    setConfirmedLines((prev) => ({ ...prev, [line.id]: true }));
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== line.id) return l;
        const counted = qty;
        const book = l.theoreticalAtCount;
        const state = counted === book ? "MATCH" : "OFF";
        const diffVal =
          book !== null && l.unitCost !== null
            ? Math.round((counted - book) * l.unitCost)
            : null;
        return {
          ...l,
          countedQty: counted,
          state,
          diffValue: diffVal,
          countedAt: new Date().toISOString(),
        };
      })
    );
  }

  // Preview action
  async function handlePreview() {
    setPreviewLoading(true);
    setGlobalError(null);
    const res = await getStocktakeConfirmPreview(session.id);
    setPreviewLoading(false);
    if (res?.error || !res?.preview) {
      setGlobalError(res?.error || "Không thể tạo bản xem trước kiểm kê");
      return;
    }
    setPreview(res.preview);
    setConfirmingApplyInline(false);
  }

  // Inline Confirm Apply action
  async function handleConfirmApply() {
    if (!preview?.planHash) return;
    setApplying(true);
    setGlobalError(null);
    const res = await confirmStocktakeSession(session.id, preview.planHash);
    setApplying(false);
    if (res?.error || !res?.result) {
      setGlobalError(res?.error || "Không thể xác nhận kiểm kê");
      return;
    }
    router.refresh();
  }

  // Inline Cancel Session action
  async function handleConfirmCancel() {
    setCancelling(true);
    setGlobalError(null);
    const res = await cancelStocktakeSession(session.id);
    setCancelling(false);
    if (res?.error) {
      setGlobalError(res.error);
      return;
    }
    router.push("/admin/inventory/stocktake");
    router.refresh();
  }

  // Format difference description for line
  function renderLineDifference(line: StocktakeLineView) {
    if (line.countedQty === null || line.theoreticalAtCount === null) {
      return <span className="text-text-muted">—</span>;
    }
    const diff = line.countedQty - line.theoreticalAtCount;
    const diffVal =
      line.diffValue !== null
        ? line.diffValue
        : line.unitCost !== null
        ? Math.round(diff * line.unitCost)
        : null;

    if (diff === 0) {
      return <span className="text-text-secondary tabular-nums">Khớp (0đ)</span>;
    }
    if (diff < 0) {
      return (
        <span className="text-danger tabular-nums">
          Thiếu {formatNumber(Math.abs(diff))} {line.unitName}
          {diffVal !== null ? ` (-${formatNumber(Math.abs(diffVal))}đ)` : ""}
        </span>
      );
    }
    return (
      <span className="text-success tabular-nums">
        Thừa {formatNumber(diff)} {line.unitName}
        {diffVal !== null ? ` (+${formatNumber(diffVal)}đ)` : ""}
      </span>
    );
  }

  const isPreviewing = preview !== null;
  const recomputedDiffs = (preview?.recomputedLines ?? []).filter(
    (l) => l.frozenQty !== l.recomputedQty
  );
  const unconfirmedLines = lines.filter((l) => l.countedQty === null);

  return (
    <div className="space-y-6 pb-28">
      <DetailHeader
        backHref="/admin/inventory/stocktake"
        backLabel="Kiểm kê"
        title={`Phiên kiểm kê ${session.id}`}
        subtitle={`Bắt đầu bởi ${session.createdByName} lúc ${formatDateTimeFull(session.createdAt)}`}
      />

      {globalError && <Alert variant="danger">{globalError}</Alert>}

      {/* Preview Section */}
      {preview && (
        <div className="bg-surface-card rounded-2xl border border-border p-5 space-y-4">
          <Alert variant="warning" title="Dự kiến áp dụng">
            {preview.ledgerCount === 0 && preview.issueCount === 0
              ? "Không có chênh lệch cần điều chỉnh. Xác nhận để khoá phiên kiểm kê."
              : `Sẽ ghi ${preview.ledgerCount} điều chỉnh sổ kho và ${preview.issueCount} dòng xuất kho (kiểm kê). Chênh lệch được giữ theo thời điểm từng mặt hàng được đếm, nên các giao dịch phát sinh sau đó vẫn được bảo toàn.`}
          </Alert>

          {recomputedDiffs.length > 0 && (
            <Alert variant="info" title="Số trên sổ đã tính lại theo giờ đếm">
              <p>
                Có phiếu nhập hoặc phiếu xuất ghi ngày trước giờ đếm nhưng nhập sau, nên số trên sổ
                lúc đếm đã được tính lại.
              </p>
              <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                {recomputedDiffs.map((rec) => {
                  const l = lines.find((candidate) => candidate.id === rec.lineId);
                  const unitName = l?.unitName || "";
                  const displayName = l?.itemName || rec.itemReference;
                  return (
                    <li key={rec.lineId || rec.itemReference}>
                      {displayName}: {formatNumber(rec.frozenQty)} → {formatNumber(rec.recomputedQty)}
                      {unitName ? ` ${unitName}` : ""}
                    </li>
                  );
                })}
              </ul>
            </Alert>
          )}

          {unconfirmedLines.length > 0 && (
            <Alert variant="danger" title={`${unconfirmedLines.length} mặt hàng chưa xác nhận`}>
              Những mặt hàng sau sẽ giữ nguyên tồn kho hiện tại, không bị đụng tới:{" "}
              {unconfirmedLines.map((l) => l.itemName).join(", ")}.
            </Alert>
          )}

          {preview.rows.length > 0 && (
            <>
              {/* Desktop Preview Table */}
              <div className="hidden md:block">
                <Table aria-label="Dự kiến áp dụng kiểm kê">
                  <TableHead>
                    <TableHeaderCell>Mặt hàng</TableHeaderCell>
                    <TableHeaderCell>Tồn hiện tại</TableHeaderCell>
                    <TableHeaderCell>Điều chỉnh</TableHeaderCell>
                    <TableHeaderCell>Dự kiến sau áp dụng</TableHeaderCell>
                  </TableHead>
                  <TableBody>
                    {preview.rows.map((row) => {
                      const l = lines.find((candidate) => candidate.id === row.lineId);
                      const unitName = l?.unitName || "";
                      const displayName = l?.itemName || row.itemReference;
                      return (
                        <TableRow key={row.lineId || row.itemReference}>
                          <TableCell>{displayName}</TableCell>
                          <TableCell align="right">
                            <span className="tabular-nums">
                              {formatNumber(row.currentTheoreticalQty)} {unitName}
                            </span>
                          </TableCell>
                          <TableCell align="right">
                            <span
                              className={`tabular-nums ${
                                row.countVariance > 0 ? "text-success" : "text-danger"
                              }`}
                            >
                              {row.countVariance > 0 ? "+" : ""}
                              {formatNumber(row.countVariance)} {unitName}
                            </span>
                          </TableCell>
                          <TableCell align="right">
                            <span className="tabular-nums">
                              {formatNumber(row.projectedQty)} {unitName}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Preview Cards */}
              <div className="md:hidden divide-y divide-border bg-surface-card rounded-card border border-border">
                {preview.rows.map((row) => {
                  const l = lines.find((candidate) => candidate.id === row.lineId);
                  const unitName = l?.unitName || "";
                  const displayName = l?.itemName || row.itemReference;
                  return (
                    <div
                      key={row.lineId || row.itemReference}
                      className="px-4 py-2.5"
                    >
                      <PhoneRow
                        title={displayName}
                        value={
                          <span
                            className={
                              row.countVariance > 0
                                ? "text-success"
                                : row.countVariance < 0
                                ? "text-danger"
                                : ""
                            }
                          >
                            {row.countVariance > 0 ? "+" : ""}
                            {formatNumber(row.countVariance)} {unitName}
                          </span>
                        }
                        meta={`Tồn hiện tại: ${formatNumber(row.currentTheoreticalQty)} ${unitName} · Sau áp dụng: ${formatNumber(row.projectedQty)} ${unitName}`}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Inline confirmation for Apply */}
          {confirmingApplyInline ? (
            <div className="bg-surface-secondary/60 border border-border rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-text-primary">
                Xác nhận áp dụng kiểm kê? Hệ thống sẽ ghi {preview.ledgerCount} điều chỉnh sổ kho và{" "}
                {preview.issueCount} dòng xuất kho.
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmingApplyInline(false)}
                  disabled={applying}
                >
                  Bỏ
                </Button>
                <Button variant="primary" onClick={handleConfirmApply} loading={applying}>
                  Xác nhận
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreview(null)} disabled={applying}>
                Quay lại chỉnh sửa
              </Button>
              <Button
                variant="primary"
                onClick={() => setConfirmingApplyInline(true)}
                disabled={applying}
              >
                Xác nhận
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Tabs bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {[
          { id: "ALL", label: "Tất cả", count: allCount },
          { id: "BLANK", label: "Chưa đếm", count: blankCount },
          { id: "OFF", label: "Lệch", count: offCount },
          { id: "MATCH", label: "Khớp", count: matchCount },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? "primary" : "secondary"}
            onClick={() => setActiveTab(tab.id as any)}
            className="text-xs md:text-sm"
          >
            {tab.label} ({tab.count})
          </Button>
        ))}
      </div>

      {/* Search box */}
      <div className="max-w-md">
        <TextInput
          id="stocktake-search"
          placeholder="Ví dụ: Bột cà phê"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Lines grouped under Phân loại hàng */}
      {filteredLines.length === 0 ? (
        <div className="p-8 text-center text-text-muted bg-surface-card rounded-2xl border border-border">
          Không có mặt hàng nào phù hợp bộ lọc
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(groups.keys()).map((groupName) => {
            const groupLines = filteredLines.filter(
              (l) => (l.groupName || "Khác") === groupName
            );
            if (groupLines.length === 0) return null;
            const stats = groups.get(groupName) || { total: 0, counted: 0 };

            return (
              <div key={groupName} className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/70 pb-2">
                  <h3 className="text-base font-semibold text-text-primary">
                    {groupName} ({stats.counted}/{stats.total})
                  </h3>
                </div>

                {/* Computer Table Layout */}
                <div className="hidden lg:block">
                  <Table>
                    <TableHead>
                      <TableHeaderCell>Mặt hàng</TableHeaderCell>
                      <TableHeaderCell>Sổ lúc đếm</TableHeaderCell>
                      <TableHeaderCell>Số đếm</TableHeaderCell>
                      <TableHeaderCell>Chênh lệch</TableHeaderCell>
                      <TableHeaderCell>Thao tác</TableHeaderCell>
                    </TableHead>
                    <TableBody>
                      {groupLines.map((line) => {
                        const isPackage = line.packageLines.length > 0;
                        const isConfirmed = confirmedLines[line.id] ?? (line.countedQty !== null);
                        const isSaving = savingLineId === line.id;
                        const error = lineErrors[line.id];

                        return (
                          <TableRow key={line.id}>
                            <TableCell>
                              <div>
                                <span className="text-text-primary">{line.itemName}</span>
                                <span className="text-xs text-text-secondary block">
                                  {line.itemReference}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell>
                              <span className="tabular-nums">
                                {line.theoreticalAtCount !== null
                                  ? `${formatNumber(line.theoreticalAtCount)} ${line.unitName}`
                                  : "—"}
                              </span>
                            </TableCell>

                            <TableCell>
                              {isPackage ? (
                                <div className="space-y-1">
                                  <div className="grid grid-cols-2 gap-2">
                                    {line.packageLines.map((pkg) => {
                                      const val = packageInputs[line.id]?.[pkg.conversionId] ?? "";
                                      return (
                                        <div key={pkg.conversionId} className="flex flex-col gap-0.5">
                                          <span className="text-xs text-text-secondary">
                                            {pkg.sizeLabel}
                                          </span>
                                          <div className="w-28">
                                            <NumberInput
                                              id={`pkg-${line.id}-${pkg.conversionId}`}
                                              decimals={3}
                                              min={0}
                                              example="12"
                                              aria-label={pkg.sizeLabel}
                                              disabled={isPreviewing || isSaving}
                                              value={val === "" ? null : Number(val)}
                                              onValueChange={(v) => {
                                                const str = v === null ? "" : String(v);
                                                setPackageInputs((prev) => ({
                                                  ...prev,
                                                  [line.id]: {
                                                    ...(prev[line.id] || {}),
                                                    [pkg.conversionId]: str,
                                                  },
                                                }));
                                                setConfirmedLines((prev) => ({
                                                  ...prev,
                                                  [line.id]: false,
                                                }));
                                                setLineErrors((prev) => ({
                                                  ...prev,
                                                  [line.id]: "",
                                                }));
                                              }}
                                            />
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {error && <span className="text-danger text-xs">{error}</span>}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <div className="w-32">
                                    <NumberInput
                                      id={`legacy-qty-${line.id}`}
                                      decimals={3}
                                      min={0}
                                      example="1,250.5"
                                      aria-label={`Số đếm ${line.itemName}`}
                                      disabled={isPreviewing || isSaving}
                                      value={
                                        legacyInputs[line.id] === undefined || legacyInputs[line.id] === ""
                                          ? null
                                          : Number(legacyInputs[line.id])
                                      }
                                      onValueChange={(v) => {
                                        const str = v === null ? "" : String(v);
                                        setLegacyInputs((prev) => ({ ...prev, [line.id]: str }));
                                        setConfirmedLines((prev) => ({ ...prev, [line.id]: false }));
                                        setLineErrors((prev) => ({ ...prev, [line.id]: "" }));
                                      }}
                                    />
                                  </div>
                                  {error && <span className="text-danger text-xs">{error}</span>}
                                </div>
                              )}
                            </TableCell>

                            <TableCell>{renderLineDifference(line)}</TableCell>

                            <TableCell align="right">
                              <div className="flex items-center justify-end gap-2">
                                {isConfirmed ? (
                                  <span className="text-xs text-success font-medium">✓ Đã lưu</span>
                                ) : line.countedQty !== null ? (
                                  <span className="text-xs text-warning">Đã sửa</span>
                                ) : null}
                                <Button
                                  variant={isConfirmed || isPreviewing ? "secondary" : "primary"}
                                  onClick={() =>
                                    isPackage
                                      ? handleSavePackageLine(line)
                                      : handleSaveLegacyLine(line)
                                  }
                                  loading={isSaving}
                                  disabled={isPreviewing}
                                >
                                  {isPackage ? "Xác nhận" : "Lưu"}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Stacked Cards Layout */}
                <div className="lg:hidden space-y-3">
                  {groupLines.map((line) => {
                    const isPackage = line.packageLines.length > 0;
                    const isConfirmed = confirmedLines[line.id] ?? (line.countedQty !== null);
                    const isSaving = savingLineId === line.id;
                    const error = lineErrors[line.id];

                    return (
                      <div
                        key={line.id}
                        data-testid={`card-${line.id}`}
                        className={`bg-surface-card rounded-2xl border p-4 space-y-3 ${
                          isConfirmed ? "border-success/60" : "border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-medium text-text-primary block">
                              {line.itemName}
                            </span>
                            <span className="text-xs text-text-secondary">
                              Sổ sách:{" "}
                              {line.theoreticalAtCount !== null
                                ? `${formatNumber(line.theoreticalAtCount)} ${line.unitName}`
                                : "—"}
                            </span>
                          </div>
                          {isConfirmed ? (
                            <span className="text-xs text-success font-medium">✓ Đã lưu</span>
                          ) : line.countedQty !== null ? (
                            <span className="text-xs text-warning">Đã sửa</span>
                          ) : null}
                        </div>

                        {/* Mobile Inputs */}
                        {isPackage ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {line.packageLines.map((pkg) => {
                              const val = packageInputs[line.id]?.[pkg.conversionId] ?? "";
                              return (
                                <label key={pkg.conversionId} className="flex flex-col gap-1">
                                  <span className="text-xs text-text-secondary">
                                    {pkg.sizeLabel}
                                  </span>
                                  <NumberInput
                                    id={`m-pkg-${line.id}-${pkg.conversionId}`}
                                    decimals={3}
                                    min={0}
                                    example="12"
                                    aria-label={pkg.sizeLabel}
                                    disabled={isPreviewing || isSaving}
                                    value={val === "" ? null : Number(val)}
                                    onValueChange={(v) => {
                                      const str = v === null ? "" : String(v);
                                      setPackageInputs((prev) => ({
                                        ...prev,
                                        [line.id]: {
                                          ...(prev[line.id] || {}),
                                          [pkg.conversionId]: str,
                                        },
                                      }));
                                      setConfirmedLines((prev) => ({
                                        ...prev,
                                        [line.id]: false,
                                      }));
                                      setLineErrors((prev) => ({ ...prev, [line.id]: "" }));
                                    }}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="w-full">
                            <NumberInput
                              id={`m-legacy-qty-${line.id}`}
                              decimals={3}
                              min={0}
                              example="1,250.5"
                              aria-label={`Số đếm ${line.itemName}`}
                              disabled={isPreviewing || isSaving}
                              value={
                                legacyInputs[line.id] === undefined || legacyInputs[line.id] === ""
                                  ? null
                                  : Number(legacyInputs[line.id])
                              }
                              onValueChange={(v) => {
                                const str = v === null ? "" : String(v);
                                setLegacyInputs((prev) => ({ ...prev, [line.id]: str }));
                                setConfirmedLines((prev) => ({ ...prev, [line.id]: false }));
                                setLineErrors((prev) => ({ ...prev, [line.id]: "" }));
                              }}
                            />
                          </div>
                        )}

                        {error && <div className="text-danger text-xs">{error}</div>}

                        <div className="flex items-center justify-between pt-2 border-t border-border/50">
                          <div className="text-xs">{renderLineDifference(line)}</div>
                          <Button
                            variant={isConfirmed || isPreviewing ? "secondary" : "primary"}
                            onClick={() =>
                              isPackage ? handleSavePackageLine(line) : handleSaveLegacyLine(line)
                            }
                            loading={isSaving}
                            disabled={isPreviewing}
                          >
                            {isPackage ? "Xác nhận" : "Lưu"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pinned Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-surface-card border-t border-border p-4 shadow-lg md:sticky md:bottom-0">
        <div className="w-full">
          {confirmingCancelInline ? (
            <div className="bg-surface-card border border-danger rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-danger">
                Huỷ phiên kiểm kê {session.id}? Toàn bộ số liệu đã đếm trong phiên này sẽ bị xoá
                hẳn.
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmingCancelInline(false)}
                  disabled={cancelling}
                >
                  Bỏ
                </Button>
                <Button variant="danger" onClick={handleConfirmCancel} loading={cancelling}>
                  Xác nhận huỷ
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm font-medium text-text-primary text-center sm:text-left">
                {provisionalSummary}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="delete"
                  onClick={() => setConfirmingCancelInline(true)}
                  disabled={previewLoading || applying}
                  className="w-1/2 sm:w-auto"
                >
                  Huỷ phiên
                </Button>
                <Button
                  variant="primary"
                  onClick={handlePreview}
                  loading={previewLoading}
                  disabled={applying}
                  className="w-1/2 sm:w-auto"
                >
                  Xem trước
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
