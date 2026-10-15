"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
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
import type { StocktakeDetailView as Detail } from "@/app/admin/inventory/stocktake/actions";

export function getVarianceText(counted: number | null, book: number | null): string {
  if (counted === null || book === null) return "";
  const diff = counted - book;
  if (diff < 0) return `Thiếu ${formatNumber(Math.abs(diff))}`;
  if (diff > 0) return `Dư ${formatNumber(diff)}`;
  return "";
}

export function StocktakeDetailView({ detail }: { detail: Detail }) {
  let actions: React.ReactNode = null;
  if (detail.editBlock === null) {
    actions = (
      <Button
        href={`/admin/inventory/stocktake/${encodeURIComponent(detail.id)}/edit`}
        variant="secondary"
      >
        Sửa
      </Button>
    );
  } else if (detail.editBlock === "NOT_LATEST") {
    actions = (
      <span className="text-sm text-text-secondary">
        Đã có phiếu kiểm kê mới hơn nên phiếu này không sửa được.
      </span>
    );
  } else if (detail.editBlock === "OPEN_SESSION") {
    actions = (
      <span className="text-sm text-text-secondary">
        Đang có phiếu kiểm kê mở, xong phiếu đó rồi mới sửa được.
      </span>
    );
  } else if (detail.editBlock === "NOT_CONFIRMED") {
    actions = (
      <span className="text-sm text-text-secondary">
        Phiếu đã huỷ nên không sửa được.
      </span>
    );
  }

  const fields: Field[] = [
    {
      label: "Trạng thái",
      value:
        detail.status === "CONFIRMED"
          ? "Đã xác nhận"
          : detail.status === "REVERSED"
          ? "Đã huỷ"
          : "Đang mở",
    },
    {
      label: "Ngày kiểm",
      value: detail.confirmedAt ? formatDateTimeFull(detail.confirmedAt) : "—",
    },
    {
      label: "Người xác nhận",
      value: detail.confirmedByName || "—",
    },
    {
      label: "Người mở phiếu",
      value: detail.createdByName || "—",
    },
  ];

  if (detail.notes && detail.notes.trim()) {
    fields.push({
      label: "Ghi chú",
      value: detail.notes,
    });
  }

  return (
    <DetailFrame>
      <DetailHeader
        backHref="/admin/inventory/stocktake"
        backLabel="Kiểm kê"
        title={detail.id}
        actions={actions}
      />

      <FieldList fields={fields} />

      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Danh sách mặt hàng ({detail.lines.length})
        </h2>

        {/* Desktop Table */}
        <div className="hidden md:block">
          <Table>
            <TableHead>
              <TableHeaderCell>Hàng</TableHeaderCell>
              <TableHeaderCell>Đơn vị</TableHeaderCell>
              <TableHeaderCell>Sổ lúc đếm</TableHeaderCell>
              <TableHeaderCell>Đếm được</TableHeaderCell>
              <TableHeaderCell>Chênh lệch</TableHeaderCell>
            </TableHead>
            <TableBody>
              {detail.lines.map((line) => {
                const varianceText = getVarianceText(
                  line.countedQty,
                  line.theoreticalAtCount,
                );
                return (
                  <TableRow key={line.id}>
                    <TableCell>{line.itemName}</TableCell>
                    <TableCell>{line.unitName}</TableCell>
                    <TableCell align="right">
                      {line.theoreticalAtCount !== null
                        ? formatNumber(line.theoreticalAtCount)
                        : "—"}
                    </TableCell>
                    <TableCell align="right">
                      {line.countedQty !== null
                        ? formatNumber(line.countedQty)
                        : "—"}
                    </TableCell>
                    <TableCell align="right">{varianceText}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards */}
        <div className="md:hidden space-y-3">
          {detail.lines.map((line) => {
            const varianceText = getVarianceText(
              line.countedQty,
              line.theoreticalAtCount,
            );
            return (
              <div
                key={line.id}
                data-line-id={line.id}
                className="bg-surface-card rounded-2xl border border-border p-4 space-y-2 text-sm"
              >
                <div className="font-medium text-text-primary">
                  {line.itemName}
                </div>
                <div className="space-y-1 text-text-secondary">
                  <div className="flex justify-between items-center">
                    <span>Sổ lúc đếm</span>
                    <span className="text-text-primary tabular-nums">
                      {line.theoreticalAtCount !== null
                        ? formatNumber(line.theoreticalAtCount)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Đếm được</span>
                    <span className="text-text-primary tabular-nums">
                      {line.countedQty !== null
                        ? formatNumber(line.countedQty)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Chênh lệch</span>
                    <span className="text-text-primary tabular-nums">
                      {varianceText || "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DetailFrame>
  );
}
