"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import { formatNumber } from "@/lib/shared/format";
import { confirm } from "@/lib/shared/dialog";
import { deleteSupplierAction, setSupplierStatus } from "../../actions";
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
    return <Badge variant="success">Hoàn thành</Badge>;
  }
  if (status === "CANCELLED") {
    return <Badge variant="neutral">Đã huỷ</Badge>;
  }
  if (status === "DRAFT") {
    return <Badge variant="warning">Nháp</Badge>;
  }
  return <Badge variant="neutral">{status}</Badge>;
}

function renderLinks(text: string | null | undefined) {
  if (!text?.trim()) return null;
  const parts = text.split(/(https?:\/\/\S+)/);
  return (
    <>
      {parts.map((part, idx) =>
        /^https?:\/\/\S+$/.test(part) ? (
          <a
            key={idx}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline break-all"
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </>
  );
}

export function SupplierDetailView({
  supplier,
  orders,
  returnTo,
  canDelete,
}: SupplierDetailViewProps) {
  const router = useRouter();
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStatusPending, setIsStatusPending] = useState(false);

  const isInactive = supplier.status === "INACTIVE";

  async function handleToggleStatus() {
    setStatusError(null);
    if (!isInactive) {
      const ok = await confirm({
        title: "Ngừng hợp tác",
        message: `Ngừng hợp tác với ${supplier.name}? Phiếu nhập mới sẽ không chọn được nhà cung cấp này.`,
        variant: "danger",
      });
      if (!ok) return;
    }

    setIsStatusPending(true);
    try {
      const fd = new FormData();
      fd.append("id", supplier.id);
      fd.append("status", isInactive ? "ACTIVE" : "INACTIVE");
      const res = await setSupplierStatus(fd);
      if (res?.error) {
        setStatusError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setIsStatusPending(false);
    }
  }

  const poPageHref = (p: number): string => {
    const base = `/admin/suppliers/${encodeURIComponent(supplier.id)}?returnTo=${encodeURIComponent(returnTo)}`;
    return p > 1 ? `${base}&poPage=${p}` : base;
  };
  const fields: Field[] = [
    { label: "Điện thoại", value: supplier.phone },
    { label: "Địa chỉ", value: supplier.address },
    { label: "Mã số thuế", value: supplier.tax_id },
    { label: "Ghi chú / liên kết", value: renderLinks(supplier.links) },
    {
      label: "Trạng thái",
      value: (
        <Badge variant={isInactive ? "neutral" : "success"}>
          {isInactive ? "Ngừng hợp tác" : "Đang hợp tác"}
        </Badge>
      ),
    },
  ];

  const editHref = `/admin/suppliers/${encodeURIComponent(supplier.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`;

  const purchaseOrdersParams = new URLSearchParams();
  purchaseOrdersParams.set("supplier", supplier.id);
  purchaseOrdersParams.set("status", "ALL");
  if (orders.daySpan) {
    purchaseOrdersParams.set("range", "CUSTOM");
    purchaseOrdersParams.set("from", orders.daySpan.first);
    purchaseOrdersParams.set("to", orders.daySpan.last);
  }
  const purchaseOrdersHref = `/admin/inventory/purchase-orders?${purchaseOrdersParams.toString()}`;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        href={editHref}
        variant="secondary"
      >
        Chỉnh sửa
      </Button>
      <Button
        type="button"
        variant={isInactive ? "secondary" : "delete"}
        loading={isStatusPending}
        onClick={handleToggleStatus}
      >
        {isInactive ? "Hợp tác lại" : "Ngừng hợp tác"}
      </Button>
      {canDelete && orders.total === 0 && (
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
            <Badge variant="neutral">
              Ngừng hợp tác
            </Badge>
          ) : undefined
        }
        actions={headerActions}
      />

      {statusError && (
        <Alert variant="danger">
          {statusError}
        </Alert>
      )}

      <FieldList fields={fields} />

      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-text-primary">
            Phiếu nhập ({orders.total})
          </h2>
          <Link
            href={purchaseOrdersHref}
            className="text-sm font-medium text-primary hover:text-primary-hover min-h-[48px] md:min-h-[40px] inline-flex items-center"
          >
            Xem trong Phiếu nhập &rarr;
          </Link>
        </div>

        {orders.rows.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center text-text-muted">
            Chưa có phiếu nhập nào.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Mã phiếu</TableHeaderCell>
                  <TableHeaderCell>Ngày nhập</TableHeaderCell>
                  <TableHeaderCell>Nguồn</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                  <TableHeaderCell>Tổng tiền</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {orders.rows.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell>
                        <Link
                          href={`/admin/inventory/purchase-orders/${encodeURIComponent(po.id)}`}
                          className="text-primary hover:text-primary-hover font-mono text-xs"
                        >
                          {po.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="whitespace-nowrap tabular-nums text-text-primary">
                          {po.dateText}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-text-primary">{po.sourceName}</span>
                      </TableCell>
                      <TableCell>
                        {renderPoStatusBadge(po.status)}
                      </TableCell>
                      <TableCell align="right">
                        <span className="tabular-nums text-text-primary">
                          {formatNumber(po.totalAmount)}đ
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border bg-surface-card rounded-card border border-border">
              {orders.rows.map((po) => (
                <Link
                  key={po.id}
                  href={`/admin/inventory/purchase-orders/${encodeURIComponent(po.id)}`}
                  className="block px-4 py-2.5 hover:bg-surface-secondary/50 transition-colors focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none min-h-[48px] md:min-h-[40px]"
                >
                  <PhoneRow
                    title={po.id}
                    value={`${formatNumber(po.totalAmount)}đ`}
                    meta={`${po.dateText} · ${po.sourceName}`}
                    badge={renderPoStatusBadge(po.status)}
                  />
                </Link>
              ))}
            </div>

            {/* Pagination Footer */}
            <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
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
          </div>
        )}
      </div>
    </DetailFrame>
  );
}
