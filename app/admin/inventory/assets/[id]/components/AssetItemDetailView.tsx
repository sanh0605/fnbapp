"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
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
                        <span className="font-mono text-xs text-primary">{lot.id}</span>
                      </TableCell>
                      <TableCell>{formatDateTimeFull(lot.acquiredDate)}</TableCell>
                      <TableCell>
                        {lot.purchaseOrderId ? (
                          <Link
                            href={`/admin/inventory/purchase-orders/${lot.purchaseOrderId}`}
                            className="font-mono text-xs text-primary hover:underline"
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

            {/* Phone Rows */}
            <div className="md:hidden bg-surface-card rounded-card border border-border divide-y divide-border">
              {detail.lots.map((lot) => {
                const metaParts = [
                  lot.id,
                  `Còn ${lot.remainingQuantity}/${lot.quantity} cái`,
                  `${formatNumber(Math.round(lot.unitCost))}đ`,
                  `${lot.termMonths} tháng`,
                  lot.purchaseOrderId,
                ].filter(Boolean);

                const content = (
                  <PhoneRow
                    title={formatDateTimeFull(lot.acquiredDate)}
                    value={`${formatNumber(Math.round(lot.remainingValue))}đ`}
                    meta={metaParts.join(" · ")}
                  />
                );

                if (lot.purchaseOrderId) {
                  return (
                    <Link
                      key={lot.id}
                      href={`/admin/inventory/purchase-orders/${lot.purchaseOrderId}`}
                      className="block px-4 py-2.5 min-h-[48px] hover:bg-surface-secondary/50 transition-colors"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div key={lot.id} className="px-4 py-2.5 min-h-[48px]">
                    {content}
                  </div>
                );
              })}
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

            {/* Phone Rows */}
            <div className="md:hidden bg-surface-card rounded-card border border-border divide-y divide-border">
              {detail.disposals.map((d) => {
                const metaNodes: React.ReactNode[] = [
                  <span key="lot">
                    {formatDateTimeFull(d.lotAcquiredDate)} <span className="whitespace-nowrap">({d.assetId})</span>
                  </span>,
                  `${d.quantity} cái`,
                  <span key="proceeds">Thu được: {renderProceeds(d.proceeds)}</span>,
                  d.reason || null,
                ].filter(Boolean);

                return (
                  <div key={d.id} className="px-4 py-2.5">
                    <PhoneRow
                      title={formatDateTimeFull(d.disposedDate)}
                      value={`${formatNumber(Math.round(d.charge))}đ`}
                      meta={
                        <span>
                          {metaNodes.map((node, i) => (
                            <React.Fragment key={i}>
                              {i > 0 && " · "}
                              {node}
                            </React.Fragment>
                          ))}
                        </span>
                      }
                    />
                  </div>
                );
              })}
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

            {/* Phone Rows */}
            <div className="md:hidden bg-surface-card rounded-card border border-border divide-y divide-border">
              {detail.months.map((m, idx) => {
                const metaParts = [
                  `${m.unitsHeld} cái`,
                  m.disposalCharge > 0 ? `gồm ${formatNumber(Math.round(m.disposalCharge))}đ thanh lý` : "",
                ].filter(Boolean);

                return (
                  <div key={idx} className="px-4 py-2.5">
                    <PhoneRow
                      title={formatMonth(m.month)}
                      value={`${formatNumber(Math.round(m.charge))}đ`}
                      meta={metaParts.join(" · ")}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DetailFrame>
  );
}
