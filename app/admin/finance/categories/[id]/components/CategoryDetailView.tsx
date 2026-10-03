"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
}: CategoryDetailViewProps): JSX.Element {
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

  const statusBadge =
    category.status === "ACTIVE" ? (
      <Badge variant="success">Đang dùng</Badge>
    ) : (
      <Badge variant="warning">Ngừng dùng</Badge>
    );

  const fields: Field[] = [
    { label: "Mã", value: category.id },
    { label: "Tên", value: category.name },
    { label: "Bên", value: KIND_LABEL[category.kind] },
    { label: "Tính vào lãi lỗ", value: pnlTreatmentLabel(category) },
    { label: "Trạng thái", value: statusBadge },
  ];

  const headerActions = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={editHref}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm min-h-[44px] flex items-center justify-center text-sm"
        >
          Chỉnh sửa
        </Link>
        {category.status === "ACTIVE" ? (
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={statusLoading}
            className="px-4 py-2 text-sm font-medium text-warning border border-warning/30 rounded-lg hover:bg-warning/10 transition min-h-[44px] flex items-center justify-center disabled:opacity-50"
          >
            {statusLoading ? "Đang xử lý..." : "Ngừng dùng"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={statusLoading}
            className="px-4 py-2 text-sm font-medium text-success border border-success/30 rounded-lg hover:bg-success/10 transition min-h-[44px] flex items-center justify-center disabled:opacity-50"
          >
            {statusLoading ? "Đang xử lý..." : "Dùng lại"}
          </button>
        )}
        {canDelete && (
          <RemoveRecordButton
            verb="Xoá hẳn"
            name={category.name}
            confirmMessage={`Xoá hẳn nhóm "${category.name}"? Không thể hoàn tác. Nếu đã có dòng sổ dùng nhóm này, hệ thống sẽ từ chối xoá.`}
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
