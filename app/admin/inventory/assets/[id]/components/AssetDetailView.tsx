"use client";

import React from "react";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { formatNumber } from "@/lib/shared/format";
import type { AssetView, AssetDisposalView } from "../../actions";
import type { MonthlyCharge } from "@/lib/assets/asset-depreciation";

export interface AssetDetailViewProps {
  asset: AssetView;
  schedule: MonthlyCharge[];
  disposals: AssetDisposalView[];
  chargedToDate: number;
  returnTo: string;
}

const BUCKET_LABEL: Record<AssetView["bucket"], string> = {
  IN_USE: "Còn dùng",
  FULLY_DEPRECIATED: "Đã hết khấu hao",
  DISPOSED: "Đã thanh lý",
};

const BUCKET_BADGE_CLASS: Record<AssetView["bucket"], string> = {
  IN_USE: "bg-primary-soft text-primary-active border-primary/20",
  FULLY_DEPRECIATED: "bg-warning/10 text-warning-active border-warning/20",
  DISPOSED: "bg-surface-secondary text-text-secondary border-border",
};

export function AssetDetailView({
  asset,
  schedule,
  disposals,
  chargedToDate,
  returnTo,
}: AssetDetailViewProps): JSX.Element {
  const detailUrl = `/admin/inventory/assets/${encodeURIComponent(asset.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const disposeHref = `/admin/inventory/assets/${encodeURIComponent(asset.id)}/dispose?returnTo=${encodeURIComponent(detailUrl)}`;

  const headerActions =
    asset.bucket !== "DISPOSED" ? (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={disposeHref}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm min-h-[44px] flex items-center justify-center text-sm"
        >
          Thanh lý
        </Link>
      </div>
    ) : undefined;

  const [y, m, d] = asset.acquiredDate.split("-");
  const acquiredFormatted = y && m && d ? `${d}/${m}/${y}` : asset.acquiredDate;

  const fields: Field[] = [
    { label: "Mã", value: asset.id },
    { label: "Tên", value: asset.name },
    { label: "Ngày mua", value: acquiredFormatted },
    {
      label: "Số lượng",
      value: `còn ${asset.remainingQuantity} / mua ${asset.quantity} cái`,
    },
    {
      label: "Đơn giá",
      value: `${formatNumber(Math.round(asset.unitCost))}đ`,
    },
    {
      label: "Tổng tiền mua",
      value: `${formatNumber(Math.round(asset.totalCost))}đ`,
    },
    {
      label: "Thời hạn khấu hao",
      value: `${asset.termMonths} tháng`,
    },
    {
      label: "Đã khấu hao đến nay",
      value: `${formatNumber(Math.round(chargedToDate))}đ`,
    },
    {
      label: "Giá trị còn lại",
      value: `${formatNumber(Math.round(asset.remainingValue))}đ`,
    },
    {
      label: "Trạng thái",
      value: BUCKET_LABEL[asset.bucket],
    },
  ];

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Tài sản"
        title={asset.name}
        subtitle={asset.id}
        badge={
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${BUCKET_BADGE_CLASS[asset.bucket]}`}
          >
            {BUCKET_LABEL[asset.bucket]}
          </span>
        }
        actions={headerActions}
      />

      <FieldList fields={fields} />

      {/* Section: Khấu hao theo tháng */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Khấu hao theo tháng
        </h2>
        {schedule.length === 0 ? (
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
                  {schedule.map((row, idx) => {
                    const [sy, sm] = row.month.split("-");
                    const monthFormatted = sy && sm ? `${sm}/${sy}` : row.month;
                    return (
                      <tr
                        key={idx}
                        className="hover:bg-surface-secondary/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-text-primary">
                          {monthFormatted}
                        </td>
                        <td className="px-6 py-4 text-center text-text-secondary">
                          {row.unitsHeld}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-text-primary">
                          {formatNumber(Math.round(row.charge))}đ
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {schedule.map((row, idx) => {
                const [sy, sm] = row.month.split("-");
                const monthFormatted = sy && sm ? `${sm}/${sy}` : row.month;
                return (
                  <div key={idx} className="p-4 flex items-center justify-between text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-text-primary">{monthFormatted}</span>
                      <span className="text-xs text-text-secondary">
                        Số cái giữ: {row.unitsHeld}
                      </span>
                    </div>
                    <div className="font-bold text-text-primary">
                      {formatNumber(Math.round(row.charge))}đ
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Section: Thanh lý (N) */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Thanh lý ({disposals.length})
        </h2>

        {disposals.length === 0 ? (
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
                    <th className="px-6 py-4 font-bold text-center">Số lượng</th>
                    <th className="px-6 py-4 font-bold">Lý do</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {disposals.map((d) => {
                    const [dy, dm, dd] = d.disposedDate.split("-");
                    const dateFormatted = dy && dm && dd ? `${dd}/${dm}/${dy}` : d.disposedDate;
                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-surface-secondary/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-medium text-text-primary">
                          {dateFormatted}
                        </td>
                        <td className="px-6 py-4 text-center text-text-secondary">
                          {d.quantity}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {d.reason || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {disposals.map((d) => {
                const [dy, dm, dd] = d.disposedDate.split("-");
                const dateFormatted = dy && dm && dd ? `${dd}/${dm}/${dy}` : d.disposedDate;
                return (
                  <div key={d.id} className="p-4 space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-text-primary">{dateFormatted}</span>
                      <span className="font-medium text-text-secondary">
                        Số lượng: {d.quantity}
                      </span>
                    </div>
                    <div className="text-text-muted text-xs">
                      Lý do: {d.reason || "—"}
                    </div>
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
