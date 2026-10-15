"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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
import type { AssetItemDetail, AssetItemDisposal } from "@/lib/assets/asset-items";

export interface AssetItemDetailViewProps {
  detail: AssetItemDetail;
  returnTo: string;
}

function renderProceeds(proceeds: AssetItemDisposal["proceeds"]) {
  if (!proceeds) {
    return "0đ";
  }
  const amountStr = `${formatNumber(Math.round(proceeds.amount))}đ`;
  const methodStr =
    proceeds.paymentMethod === "BANK_TRANSFER"
      ? proceeds.bankAccountName || "Chuyển khoản"
      : "Tiền mặt";

  if (proceeds.status === "CANCELLED") {
    return (
      <span>
        <span className="line-through">{amountStr}</span> · {methodStr} (đã huỷ)
      </span>
    );
  }

  return `${amountStr} · ${methodStr}`;
}

function formatMonth(monthStr: string): string {
  const [y, m, d] = monthStr.split("-");
  return y && m ? `${m}/${y}` : monthStr;
}

export function AssetItemDetailView({
  detail,
  returnTo,
}: AssetItemDetailViewProps) {
  const detailUrl = `/admin/inventory/assets/${encodeURIComponent(detail.item.itemId)}?returnTo=${encodeURIComponent(returnTo)}`;
  const disposeHref = `/admin/inventory/assets/${encodeURIComponent(detail.item.itemId)}/dispose?returnTo=${encodeURIComponent(detailUrl)}`;

  const isFullyDisposed = detail.item.fullyDisposed || detail.item.remainingQuantity === 0;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        href={`/admin/inventory/items/${encodeURIComponent(detail.item.itemId)}`}
        variant="secondary"
      >
        Xem hàng hoá
      </Button>
      {!isFullyDisposed && (
        <Button
          href={disposeHref}
          variant="delete"
        >
          Thanh lý
        </Button>
      )}
    </div>
  );

  const fields: Field[] = [
    { label: "Mã hàng", value: detail.item.itemId },
    { label: "Tên", value: detail.item.name },
    {
      label: "Còn / Đã mua",
      value: `${detail.item.remainingQuantity} / ${detail.item.quantity} cái`,
    },
    {
      label: "Đã thanh lý",
      value: `${detail.item.disposedQuantity} cái`,
    },
    {
      label: "Tổng tiền đã mua",
      value: `${formatNumber(Math.round(detail.item.totalCost))}đ`,
    },
    {
      label: "Đã khấu hao đến nay",
      value: `${formatNumber(Math.round(detail.item.chargedToDate))}đ`,
    },
    {
      label: "Giá trị còn lại",
      value: `${formatNumber(Math.round(detail.item.remainingValue))}đ`,
    },
  ];

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Tài sản"
        title={detail.item.name}
        subtitle={detail.item.itemId}
        badge={
          isFullyDisposed ? (
            <Badge variant="neutral">
              Đã thanh lý hết
            </Badge>
          ) : undefined
        }
        actions={headerActions}
      />

      <FieldList fields={fields} />

      {/* Section 1: Các lần mua */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Các lần mua ({detail.lots.length})
        </h2>
        {detail.lots.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa có thông tin lần mua.
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table aria-label="Các lần mua">
                <TableHead>
                  <TableHeaderCell>Mã tài sản</TableHeaderCell>
                  <TableHeaderCell>Ngày mua</TableHeaderCell>
                  <TableHeaderCell>Phiếu nhập</TableHeaderCell>
                  <TableHeaderCell>Còn / Mua</TableHeaderCell>
                  <TableHeaderCell>Giá một cái</TableHeaderCell>
                  <TableHeaderCell>Thời hạn</TableHeaderCell>
                  <TableHeaderCell>Giá trị còn lại</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {detail.lots.map((lot) => (
                    <TableRow key={lot.id}>
                      <TableCell>
                        <span className="font-mono text-primary">{lot.id}</span>
                      </TableCell>
                      <TableCell>{formatDateTimeFull(lot.acquiredDate)}</TableCell>
                      <TableCell>
                        {lot.purchaseOrderId ? (
                          <Link
                            href={`/admin/inventory/purchase-orders/${lot.purchaseOrderId}`}
                            className="font-mono text-primary hover:underline"
                          >
                            {lot.purchaseOrderId}
                          </Link>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        {lot.remainingQuantity} / {lot.quantity} cái
                      </TableCell>
                      <TableCell align="right">
                        {formatNumber(Math.round(lot.unitCost))}đ
                      </TableCell>
                      <TableCell align="right">{lot.termMonths} tháng</TableCell>
                      <TableCell align="right">
                        {formatNumber(Math.round(lot.remainingValue))}đ
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden bg-surface-card rounded-card border border-border divide-y divide-border">
              {detail.lots.map((lot) => (
                <div key={lot.id} className="p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-text-secondary">
                      {lot.id}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatDateTimeFull(lot.acquiredDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Phiếu nhập</span>
                    {lot.purchaseOrderId ? (
                      <Link
                        href={`/admin/inventory/purchase-orders/${lot.purchaseOrderId}`}
                        className="font-mono text-primary hover:underline min-h-[44px] md:min-h-[40px] flex items-center"
                      >
                        {lot.purchaseOrderId}
                      </Link>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Còn / Mua</span>
                    <span className="text-text-primary">
                      {lot.remainingQuantity} / {lot.quantity} cái
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Giá một cái</span>
                    <span className="text-text-primary">
                      {formatNumber(Math.round(lot.unitCost))}đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Thời hạn</span>
                    <span className="text-text-secondary">{lot.termMonths} tháng</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Giá trị còn lại</span>
                    <span className="text-primary">
                      {formatNumber(Math.round(lot.remainingValue))}đ
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 2: Thanh lý */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Thanh lý ({detail.disposals.length})
        </h2>
        {detail.disposals.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa thanh lý lần nào.
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table aria-label="Thanh lý">
                <TableHead>
                  <TableHeaderCell>Ngày</TableHeaderCell>
                  <TableHeaderCell>Lần mua</TableHeaderCell>
                  <TableHeaderCell>Số lượng</TableHeaderCell>
                  <TableHeaderCell>Thu được</TableHeaderCell>
                  <TableHeaderCell>Lý do</TableHeaderCell>
                  <TableHeaderCell>Tiền dồn vào chi phí</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {detail.disposals.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{formatDateTimeFull(d.disposedDate)}</TableCell>
                      <TableCell>
                        {formatDateTimeFull(d.lotAcquiredDate)} ({d.assetId})
                      </TableCell>
                      <TableCell align="right">{d.quantity}</TableCell>
                      <TableCell>{renderProceeds(d.proceeds)}</TableCell>
                      <TableCell>{d.reason || "—"}</TableCell>
                      <TableCell align="right">
                        {formatNumber(Math.round(d.charge))}đ
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden bg-surface-card rounded-card border border-border divide-y divide-border">
              {detail.disposals.map((d) => (
                <div key={d.id} className="p-4 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-text-primary">
                      {formatDateTimeFull(d.disposedDate)}
                    </span>
                    <span className="text-text-primary">
                      {formatNumber(Math.round(d.charge))}đ
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary">
                    Lần mua: {formatDateTimeFull(d.lotAcquiredDate)} ({d.assetId}) · Số lượng: {d.quantity}
                  </div>
                  <div className="text-xs text-text-secondary">
                    Thu được: {renderProceeds(d.proceeds)}
                  </div>
                  <div className="text-xs text-text-muted">
                    Lý do: {d.reason || "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Khấu hao theo tháng */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Khấu hao theo tháng
        </h2>
        {detail.months.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa có lịch khấu hao.
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table aria-label="Khấu hao theo tháng">
                <TableHead>
                  <TableHeaderCell>Tháng</TableHeaderCell>
                  <TableHeaderCell>Số cái giữ</TableHeaderCell>
                  <TableHeaderCell>Khấu hao</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {detail.months.map((m, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{formatMonth(m.month)}</TableCell>
                      <TableCell align="right">{m.unitsHeld}</TableCell>
                      <TableCell align="right">
                        <div>{formatNumber(Math.round(m.charge))}đ</div>
                        {m.disposalCharge > 0 && (
                          <div className="text-xs text-text-muted">
                            gồm {formatNumber(Math.round(m.disposalCharge))}đ thanh lý
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden bg-surface-card rounded-card border border-border divide-y divide-border">
              {detail.months.map((m, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-text-primary">
                      {formatMonth(m.month)}
                    </span>
                    <span className="text-xs text-text-secondary">
                      Số cái giữ: {m.unitsHeld}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-text-primary">
                      {formatNumber(Math.round(m.charge))}đ
                    </div>
                    {m.disposalCharge > 0 && (
                      <div className="text-xs text-text-muted">
                        gồm {formatNumber(Math.round(m.disposalCharge))}đ thanh lý
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DetailFrame>
  );
}
