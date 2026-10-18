"use client";

import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field as DetailField } from "@/components/ui/detail/FieldList";
import { Field } from "@/components/ui/Field";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
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
import { useStocktakeLinesFilter } from "./useStocktakeLinesFilter";
import type { StocktakeSessionView, StocktakeLineView, StocktakeListRow } from "../../actions";

export function getVarianceText(counted: number | null, book: number | null, unitName?: string): string {
  if (counted === null || book === null) return "";
  const diff = counted - book;
  const unit = unitName ? ` ${unitName}` : "";
  if (diff === 0) return "Khớp";
  if (diff < 0) return `Thiếu ${formatNumber(Math.abs(diff))}${unit}`;
  return `Thừa ${formatNumber(diff)}${unit}`;
}

export interface StocktakeDetailViewProps {
  session: StocktakeSessionView;
  isLatestConfirmed: boolean;
  isOwner: boolean;
  hasOpenSession?: boolean;
  listRow?: StocktakeListRow;
}

export function StocktakeDetailView({
  session,
  isLatestConfirmed,
  isOwner,
  hasOpenSession = false,
  listRow,
}: StocktakeDetailViewProps) {
  const lines = session.lines;
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    allCount,
    blankCount,
    offCount,
    matchCount,
    hasBlank,
    filteredLines,
    groups,
  } = useStocktakeLinesFilter(lines);

  // Action buttons on top
  let actions: React.ReactNode = null;
  if (session.status === "CONFIRMED" && isLatestConfirmed && isOwner && !hasOpenSession) {
    actions = (
      <div className="flex gap-2">
        <Button
          href={`/admin/inventory/stocktake/${encodeURIComponent(session.id)}/edit`}
          variant="secondary"
        >
          Sửa số đếm
        </Button>
        <Button
          href={`/admin/inventory/stocktake/${encodeURIComponent(session.id)}/cancel`}
          variant="delete"
        >
          Hoàn tác
        </Button>
      </div>
    );
  } else if (session.status === "REVERSED") {
    actions = (
      <span className="text-sm text-text-secondary">
        Phiếu đã hoàn tác.
      </span>
    );
  } else if (!isOwner) {
    actions = (
      <span className="text-sm text-text-secondary">
        Chỉ Chủ quán mới có thể sửa hoặc hoàn tác phiếu kiểm kê.
      </span>
    );
  } else if (hasOpenSession) {
    actions = (
      <span className="text-sm text-text-secondary">
        Đang có phiếu kiểm kê mở, xong phiếu đó rồi mới sửa được.
      </span>
    );
  } else if (!isLatestConfirmed) {
    actions = (
      <span className="text-sm text-text-secondary">
        Đã có phiếu kiểm kê mới hơn nên phiếu này không sửa hoặc hoàn tác được.
      </span>
    );
  }

  const fields: DetailField[] = [
    {
      label: "Trạng thái",
      value: session.status === "CONFIRMED" ? "Đã xác nhận" : "Đã hoàn tác",
    },
    {
      label: "Ngày kiểm",
      value: session.confirmedAt ? formatDateTimeFull(session.confirmedAt) : "—",
    },
    {
      label: "Người xác nhận",
      value: session.confirmedByName || "—",
    },
    ...(listRow && session.status === "CONFIRMED"
      ? [
          {
            label: "Giá trị lệch",
            value: formatStocktakeDiffValue(listRow),
          },
        ]
      : []),
  ];

  function formatDiffQuantity(line: StocktakeLineView) {
    return getVarianceText(line.countedQty, line.theoreticalAtCount, line.unitName) || "—";
  }

  function formatDiffValue(line: StocktakeLineView) {
    if (session.status === "REVERSED" || line.diffValue === null) return "—";
    if (line.diffValue === 0) return "0đ";
    if (line.diffValue < 0) return `-${formatNumber(Math.abs(line.diffValue))}đ`;
    return `+${formatNumber(line.diffValue)}đ`;
  }

  return (
    <DetailFrame>
      <DetailHeader
        backHref="/admin/inventory/stocktake"
        backLabel="Kiểm kê"
        title={session.id}
        actions={actions}
      />

      <FieldList fields={fields} />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3 pt-2">
        {[
          { id: "ALL" as const, label: "Tất cả", count: allCount, show: true },
          { id: "BLANK" as const, label: "Chưa đếm", count: blankCount, show: hasBlank },
          { id: "OFF" as const, label: "Lệch", count: offCount, show: true },
          { id: "MATCH" as const, label: "Khớp", count: matchCount, show: true },
        ]
          .filter((tab) => tab.show)
          .map((tab) => {
            // Same chips as the counting screen (StocktakeCountView)
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-3 min-h-[48px] md:min-h-[40px] text-xs md:text-sm font-medium border ${
                  active
                    ? "bg-primary-soft text-primary border-primary/20"
                    : "bg-surface-card text-text-primary border-border"
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
      </div>

      {/* Search box */}
      <div className="max-w-md">
        <Field label="Tìm hàng" htmlFor="stocktake-detail-search">
          <TextInput
            id="stocktake-detail-search"
            placeholder="Ví dụ: Bột cà phê"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </Field>
      </div>

      {/* Grouped lines */}
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
                <div className="border-b border-border/70 pb-2">
                  <h3 className="text-base font-semibold text-text-primary">
                    {groupName} ({stats.counted}/{stats.total})
                  </h3>
                </div>

                {/* Computer Table Layout */}
                <div className="hidden md:block">
                  <Table>
                    <TableHead>
                      <TableHeaderCell>Mặt hàng</TableHeaderCell>
                      <TableHeaderCell>Đơn vị</TableHeaderCell>
                      <TableHeaderCell>Sổ lúc đếm</TableHeaderCell>
                      <TableHeaderCell>Đếm được</TableHeaderCell>
                      <TableHeaderCell>Chênh lệch số lượng</TableHeaderCell>
                      <TableHeaderCell>Chênh lệch giá trị</TableHeaderCell>
                    </TableHead>
                    <TableBody>
                      {groupLines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            <div>
                              <span className="text-text-primary">{line.itemName}</span>
                              <span className="text-xs text-text-secondary block">
                                {line.itemReference}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{line.unitName}</TableCell>
                          <TableCell align="right">
                            <span className="tabular-nums">
                              {line.theoreticalAtCount !== null
                                ? formatNumber(line.theoreticalAtCount)
                                : "—"}
                            </span>
                          </TableCell>
                          <TableCell align="right">
                            <span className="tabular-nums">
                              {line.countedQty !== null ? formatNumber(line.countedQty) : "—"}
                            </span>
                          </TableCell>
                          <TableCell align="right">
                            <span className="tabular-nums whitespace-nowrap">{formatDiffQuantity(line)}</span>
                          </TableCell>
                          <TableCell align="right">
                            <span className="tabular-nums">{formatDiffValue(line)}</span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile PhoneRow Layout */}
                <div className="md:hidden divide-y divide-border bg-surface-card rounded-card border border-border">
                  {groupLines.map((line) => {
                    const book =
                      line.theoreticalAtCount !== null
                        ? `${formatNumber(line.theoreticalAtCount)} ${line.unitName}`
                        : "—";
                    const counted =
                      line.countedQty !== null
                        ? `${formatNumber(line.countedQty)} ${line.unitName}`
                        : "—";
                    const diff = formatDiffQuantity(line);
                    return (
                      <div
                        key={line.id}
                        data-line-id={line.id}
                        className="px-4 py-2.5"
                      >
                        <PhoneRow
                          title={line.itemName}
                          value={formatDiffValue(line)}
                          meta={
                            <span>
                              Sổ {book} · Đếm {counted} · <span className="whitespace-nowrap">{diff}</span>
                            </span>
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DetailFrame>
  );
}
