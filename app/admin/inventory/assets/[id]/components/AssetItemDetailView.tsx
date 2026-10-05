"use client";

import React from "react";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { formatNumber } from "@/lib/shared/format";
import type { AssetItemDetail } from "@/lib/assets/asset-items";

export interface AssetItemDetailViewProps {
  detail: AssetItemDetail;
  returnTo: string;
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return y && m && d ? `${d}/${m}/${y}` : dateStr;
}

function formatMonth(monthStr: string): string {
  const [y, m] = monthStr.split("-");
  return y && m ? `${m}/${y}` : monthStr;
}

export function AssetItemDetailView({
  detail,
  returnTo,
}: AssetItemDetailViewProps): JSX.Element {
  const detailUrl = `/admin/inventory/assets/${encodeURIComponent(detail.item.itemId)}?returnTo=${encodeURIComponent(returnTo)}`;
  const disposeHref = `/admin/inventory/assets/${encodeURIComponent(detail.item.itemId)}/dispose?returnTo=${encodeURIComponent(detailUrl)}`;

  const isFullyDisposed = detail.item.fullyDisposed || detail.item.remainingQuantity === 0;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/admin/inventory/items/${encodeURIComponent(detail.item.itemId)}`}
        className="border border-border bg-surface-card text-text-primary px-4 py-2 rounded-lg font-medium hover:bg-surface-secondary transition min-h-[44px] flex items-center justify-center text-sm shadow-sm"
      >
        Xem hàng hoá
      </Link>
      {!isFullyDisposed && (
        <Link
          href={disposeHref}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm min-h-[44px] flex items-center justify-center text-sm"
        >
          Thanh lý
        </Link>
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
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border bg-surface-secondary text-text-secondary border-border">
              Đã thanh lý hết
            </span>
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
          <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4 font-bold">Mã tài sản</th>
                    <th className="px-6 py-4 font-bold">Ngày mua</th>
                    <th className="px-6 py-4 font-bold">Phiếu nhập</th>
                    <th className="px-6 py-4 font-bold text-center">Còn / Mua</th>
                    <th className="px-6 py-4 font-bold text-right">Giá một cái</th>
                    <th className="px-6 py-4 font-bold text-center">Thời hạn</th>
                    <th className="px-6 py-4 font-bold text-right">Giá trị còn lại</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detail.lots.map((lot) => (
                    <tr
                      key={lot.id}
                      className="hover:bg-surface-secondary/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-text-secondary">
                        {lot.id}
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {formatDate(lot.acquiredDate)}
                      </td>
                      <td className="px-6 py-4">
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
                      </td>
                      <td className="px-6 py-4 text-center text-text-primary">
                        {lot.remainingQuantity} / {lot.quantity} cái
                      </td>
                      <td className="px-6 py-4 text-right text-text-secondary">
                        {formatNumber(Math.round(lot.unitCost))}đ
                      </td>
                      <td className="px-6 py-4 text-center text-text-secondary">
                        {lot.termMonths} tháng
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-text-primary">
                        {formatNumber(Math.round(lot.remainingValue))}đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {detail.lots.map((lot) => (
                <div key={lot.id} className="p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-text-secondary">
                      {lot.id}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {formatDate(lot.acquiredDate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Phiếu nhập</span>
                    {lot.purchaseOrderId ? (
                      <Link
                        href={`/admin/inventory/purchase-orders/${lot.purchaseOrderId}`}
                        className="font-mono text-primary hover:underline min-h-[44px] flex items-center"
                      >
                        {lot.purchaseOrderId}
                      </Link>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-secondary">Còn / Mua</span>
                    <span className="font-semibold text-text-primary">
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
                    <span className="font-bold text-primary">
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
          <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4 font-bold">Ngày</th>
                    <th className="px-6 py-4 font-bold">Lần mua</th>
                    <th className="px-6 py-4 font-bold text-center">Số lượng</th>
                    <th className="px-6 py-4 font-bold">Lý do</th>
                    <th className="px-6 py-4 font-bold text-right">Tiền dồn vào chi phí</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detail.disposals.map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-surface-secondary/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-text-primary">
                        {formatDate(d.disposedDate)}
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {formatDate(d.lotAcquiredDate)} ({d.assetId})
                      </td>
                      <td className="px-6 py-4 text-center text-text-secondary">
                        {d.quantity}
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {d.reason || "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-text-primary">
                        {formatNumber(Math.round(d.charge))}đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {detail.disposals.map((d) => (
                <div key={d.id} className="p-4 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary">
                      {formatDate(d.disposedDate)}
                    </span>
                    <span className="font-medium text-text-primary">
                      {formatNumber(Math.round(d.charge))}đ
                    </span>
                  </div>
                  <div className="text-xs text-text-secondary">
                    Lần mua: {formatDate(d.lotAcquiredDate)} ({d.assetId}) · Số lượng: {d.quantity}
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
          <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4 font-bold">Tháng</th>
                    <th className="px-6 py-4 font-bold text-center">Số cái giữ</th>
                    <th className="px-6 py-4 font-bold text-right">Khấu hao</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {detail.months.map((m, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-surface-secondary/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-text-primary">
                        {formatMonth(m.month)}
                      </td>
                      <td className="px-6 py-4 text-center text-text-secondary">
                        {m.unitsHeld}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-medium text-text-primary">
                          {formatNumber(Math.round(m.charge))}đ
                        </div>
                        {m.disposalCharge > 0 && (
                          <div className="text-xs text-text-muted">
                            gồm {formatNumber(Math.round(m.disposalCharge))}đ thanh lý
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {detail.months.map((m, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold text-text-primary">
                      {formatMonth(m.month)}
                    </span>
                    <span className="text-xs text-text-secondary">
                      Số cái giữ: {m.unitsHeld}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-text-primary">
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
