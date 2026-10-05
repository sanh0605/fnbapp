"use client";

import React from "react";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { formatNumber } from "@/lib/shared/format";
import { deleteSupplierAction } from "../../actions";
import type { DBSupplier } from "@/types/db";
import type { PurchaseOrderListPage } from "@/lib/purchasing/purchase-order-list";

export interface SupplierDetailViewProps {
  supplier: DBSupplier;
  orders: PurchaseOrderListPage;
  returnTo: string;
  canDelete: boolean;
}

function renderPoStatusBadge(status: string) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary-soft text-primary border border-primary/30">
        Hoàn thành
      </span>
    );
  }
  if (status === "CANCELLED") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-surface-secondary text-text-muted border border-border">
        Đã huỷ
      </span>
    );
  }
  if (status === "DRAFT") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-surface-secondary text-text-secondary border border-border">
        Nháp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-surface-secondary text-text-secondary border border-border">
      {status}
    </span>
  );
}

export function SupplierDetailView({
  supplier,
  orders,
  returnTo,
  canDelete,
}: SupplierDetailViewProps): JSX.Element {
  const poPageHref = (p: number): string => {
    const base = `/admin/suppliers/${encodeURIComponent(supplier.id)}?returnTo=${encodeURIComponent(returnTo)}`;
    return p > 1 ? `${base}&poPage=${p}` : base;
  };
  const fields: Field[] = [
    { label: "Mã", value: supplier.id },
    { label: "Tên", value: supplier.name },
    { label: "Điện thoại", value: supplier.phone },
    { label: "Địa chỉ", value: supplier.address },
    { label: "Mã số thuế", value: supplier.tax_id },
    { label: "Ghi chú / liên kết", value: supplier.links },
    {
      label: "Trạng thái",
      value: supplier.status === "INACTIVE" ? "Ngừng hợp tác" : "Đang hợp tác",
    },
  ];

  const editHref = `/admin/suppliers/${encodeURIComponent(supplier.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={editHref}
        className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm min-h-[44px] flex items-center justify-center text-sm"
      >
        Chỉnh sửa
      </Link>
      {canDelete && (
        <RemoveRecordButton
          verb="Xoá"
          name={supplier.name}
          confirmMessage={`Bạn có chắc chắn muốn xoá nhà cung cấp "${supplier.name}"?`}
          remove={async () => {
            const fd = new FormData();
            fd.append("id", supplier.id);
            const res = await deleteSupplierAction(fd);
            if (res?.error) {
              return { error: res.error };
            }
            return {};
          }}
          afterHref={returnTo}
        />
      )}
    </div>
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Nhà cung cấp"
        title={supplier.name}
        subtitle={supplier.id}
        badge={
          supplier.status === "INACTIVE" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-secondary text-text-secondary border border-border">
              Ngừng hợp tác
            </span>
          ) : undefined
        }
        actions={headerActions}
      />

      <FieldList fields={fields} />

      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-text-primary">
            Phiếu nhập ({orders.total})
          </h2>
          <Link
            href={`/admin/inventory/purchase-orders?supplier=${encodeURIComponent(supplier.id)}`}
            className="text-sm font-medium text-primary hover:text-primary-hover min-h-[44px] inline-flex items-center"
          >
            Xem trong Phiếu nhập &rarr;
          </Link>
        </div>

        {orders.rows.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center text-text-muted">
            Chưa có phiếu nhập nào.
          </div>
        ) : (
          <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4 font-bold">Mã phiếu</th>
                    <th className="px-6 py-4 font-bold">Ngày nhập</th>
                    <th className="px-6 py-4 font-bold">Nguồn</th>
                    <th className="px-6 py-4 font-bold">Trạng thái</th>
                    <th className="px-6 py-4 font-bold text-right">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.rows.map((po) => (
                    <tr
                      key={po.id}
                      className="hover:bg-surface-secondary/50 transition-colors group relative"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/admin/inventory/purchase-orders/${encodeURIComponent(po.id)}`}
                          className="absolute inset-0 z-10 focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none"
                        >
                          <span className="sr-only">Xem chi tiết {po.id}</span>
                        </Link>
                        <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
                          {po.id}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums text-text-primary">
                        {po.dateText}
                      </td>
                      <td className="px-6 py-4 text-text-primary">
                        {po.sourceName}
                      </td>
                      <td className="px-6 py-4">
                        {renderPoStatusBadge(po.status)}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-text-primary">
                        {formatNumber(po.totalAmount)}đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {orders.rows.map((po) => (
                <Link
                  key={po.id}
                  href={`/admin/inventory/purchase-orders/${encodeURIComponent(po.id)}`}
                  className="block p-4 hover:bg-surface-secondary/50 transition-colors focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none min-h-[44px]"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-mono text-[11px] text-text-muted font-bold">
                      {po.id}
                    </span>
                    <span className="font-bold text-text-primary text-base">
                      {formatNumber(po.totalAmount)}đ
                    </span>
                  </div>
                  <div className="flex justify-between items-end gap-2 mt-2">
                    <div className="text-xs text-text-muted">
                      {po.dateText} · {po.sourceName}
                    </div>
                    <div>{renderPoStatusBadge(po.status)}</div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination Footer */}
            <ListPagination
              slice={{
                page: orders.page,
                pageCount: orders.pageCount,
                firstIndex: orders.firstIndex,
                lastIndex: orders.lastIndex,
                total: orders.total,
              }}
              unit="phiếu"
              pageHref={poPageHref}
            />
          </div>
        )}
      </div>
    </DetailFrame>
  );
}
