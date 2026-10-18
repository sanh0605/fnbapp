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
import { setCashCategoryStatus, deleteCashCategory } from "@/app/admin/finance/categories/actions";
import { pnlTreatmentLabel } from "@/app/admin/finance/categories/components/CategoriesClient";
import type { DBCashCategory } from "@/types/db";

export interface CategoryDetailViewProps {
  category: DBCashCategory;
  returnTo: string;
  canDelete: boolean;
}

const KIND_LABEL: Record<DBCashCategory["kind"], string> = {
  EXPENSE: "Chi",
  INCOME: "Thu",
};

export function CategoryDetailView({
  category,
  returnTo,
  canDelete,
}: CategoryDetailViewProps) {
  const router = useRouter();
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentDetailUrl = `/admin/finance/categories/${encodeURIComponent(category.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/finance/categories/${encodeURIComponent(category.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const handleToggleStatus = async () => {
    setActionError(null);
    const nextStatus = category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const approved = await confirm({
      title: nextStatus === "INACTIVE" ? "Ngừng dùng nhóm" : "Dùng lại nhóm",
      message:
        nextStatus === "INACTIVE"
          ? `Ngừng dùng nhóm "${category.name}"? Nhóm sẽ không còn hiện khi ghi khoản thu chi mới, nhưng các dòng đã ghi vẫn giữ nguyên.`
          : `Dùng lại nhóm "${category.name}"?`,
      okText: nextStatus === "INACTIVE" ? "Ngừng dùng" : "Dùng lại",
      cancelText: "Huỷ",
      variant: nextStatus === "INACTIVE" ? "warning" : "info",
    });
    if (!approved) return;

    setStatusLoading(true);
    try {
      const fd = new FormData();
      fd.set("id", category.id);
      fd.set("status", nextStatus);
      const res = await setCashCategoryStatus(fd);
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
    { label: "Bên", value: KIND_LABEL[category.kind] },
    { label: "Tính vào lãi lỗ", value: pnlTreatmentLabel(category) },
  ];

  const headerActions = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button href={editHref} variant="secondary">
          Chỉnh sửa
        </Button>
        {category.status === "ACTIVE" ? (
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
        {canDelete && (
          <RemoveRecordButton
            verb="Xoá"
            name={category.name}
            confirmMessage={`Xoá nhóm "${category.name}"? Không thể hoàn tác. Nếu đã có dòng sổ dùng nhóm này, hệ thống sẽ từ chối xoá.`}
            remove={async () => {
              const fd = new FormData();
              fd.set("id", category.id);
              return await deleteCashCategory(fd);
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
        backLabel="Nhóm thu chi"
        title={category.name}
        subtitle={category.id}
        badge={category.status !== "ACTIVE" ? <Badge variant="warning">Ngừng dùng</Badge> : undefined}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
