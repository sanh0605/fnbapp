"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { Badge } from "@/components/ui/Badge";
import { confirm } from "@/lib/shared/dialog";
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
  const [actionError, setActionError] = useState<string | null>(null);

  const currentDetailUrl = `/admin/finance/monthly-items/${encodeURIComponent(item.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/finance/monthly-items/${encodeURIComponent(item.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;
  const categoryName = category?.name ?? item.cash_category_id;

  const handleToggleStatus = async () => {
    setActionError(null);
    const nextStatus = item.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const approved = await confirm({
      title: nextStatus === "INACTIVE" ? "Ngừng dùng khoản chi" : "Dùng lại khoản chi",
      message:
        nextStatus === "INACTIVE"
          ? `Ngừng dùng khoản chi "${item.name}"? Khoản này sẽ không còn được nhắc nhở ở Tổng quan mỗi tháng.`
          : `Dùng lại khoản chi "${item.name}"?`,
      okText: nextStatus === "INACTIVE" ? "Ngừng dùng" : "Dùng lại",
      cancelText: "Huỷ",
      variant: nextStatus === "INACTIVE" ? "warning" : "info",
    });
    if (!approved) return;

    setStatusLoading(true);
    try {
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

  const fields: Field[] = [
    { label: "Nhóm chi", value: categoryName },
    { label: "Số dòng đã nhập", value: `${formatNumber(entryCount)} dòng` },
  ];

  const headerActions = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button href={editHref} variant="secondary">
          Chỉnh sửa
        </Button>
        {item.status === "ACTIVE" ? (
          <Button
            type="button"
            variant="delete"
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
          <RemoveRecordButton
            verb="Xoá"
            name={item.name}
            confirmMessage={`Xoá khoản chi "${item.name}"? Không thể hoàn tác.`}
            remove={async () => {
              const fd = new FormData();
              fd.set("id", item.id);
              return await deleteMonthlyItem(fd);
            }}
            afterHref={returnTo}
          />
        )}
      </div>
      {actionError && (
        <Alert variant="danger">
          {actionError}
        </Alert>
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
