"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/shared/format";
import { setMonthlyItemStatus, deleteMonthlyItem } from "../../actions";
import type { DBMonthlyExpenseItem, DBCashCategory } from "@/types/db";

export interface MonthlyItemDetailViewProps {
  item: DBMonthlyExpenseItem;
  category?: DBCashCategory;
  entryCount: number;
  canDelete: boolean;
  returnTo: string;
}

export function MonthlyItemDetailView({
  item,
  category,
  entryCount,
  canDelete,
  returnTo,
}: MonthlyItemDetailViewProps) {
  const router = useRouter();
  const [statusLoading, setStatusLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentDetailUrl = `/admin/finance/monthly-items/${encodeURIComponent(item.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/finance/monthly-items/${encodeURIComponent(item.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;
  const categoryName = category?.name ?? item.cash_category_id;

  const handleToggleStatus = async () => {
    setActionError(null);
    setStatusLoading(true);
    try {
      const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const fd = new FormData();
      fd.set("id", item.id);
      fd.set("status", nextStatus);
      const res = await setMonthlyItemStatus(fd);
      if (res?.error) {
        setActionError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    setActionError(null);
    setDeleteLoading(true);
    try {
      const fd = new FormData();
      fd.set("id", item.id);
      const res = await deleteMonthlyItem(fd);
      if (res?.error) {
        setActionError(res.error);
      } else {
        router.push(returnTo);
        router.refresh();
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const statusBadge =
    item.status === "ACTIVE" ? (
      <Badge variant="success">Đang dùng</Badge>
    ) : (
      <Badge variant="warning">Ngừng dùng</Badge>
    );

  const fields: Field[] = [
    { label: "Mã", value: item.id },
    { label: "Tên khoản", value: item.name },
    { label: "Nhóm chi", value: categoryName },
    { label: "Trạng thái", value: statusBadge },
    { label: "Số dòng đã nhập", value: `${formatNumber(entryCount)} dòng` },
  ];

  const headerActions = (
    <div className="flex flex-col gap-2">
      {confirmingDelete ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text-secondary">Xoá khoản này?</span>
          <Button
            type="button"
            variant="delete"
            loading={deleteLoading}
            onClick={handleDelete}
          >
            Xoá
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={deleteLoading}
            onClick={() => {
              setConfirmingDelete(false);
              setActionError(null);
            }}
          >
            Bỏ
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button href={editHref} variant="secondary">
            Sửa
          </Button>
          {item.status === "ACTIVE" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleToggleStatus}
              loading={statusLoading}
            >
              Ngừng dùng
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={handleToggleStatus}
              loading={statusLoading}
            >
              Dùng lại
            </Button>
          )}
          {canDelete && entryCount === 0 && (
            <Button
              type="button"
              variant="delete"
              onClick={() => setConfirmingDelete(true)}
            >
              Xoá
            </Button>
          )}
        </div>
      )}
      {actionError && (
        <div
          role="alert"
          className="text-sm font-medium text-danger bg-danger/10 border border-danger/20 rounded-lg p-3"
        >
          {actionError}
        </div>
      )}
    </div>
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Khoản chi hằng tháng"
        title={item.name}
        subtitle={item.id}
        badge={item.status !== "ACTIVE" ? <Badge variant="warning">Ngừng dùng</Badge> : undefined}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
