"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { deleteItemCategory } from "@/app/admin/inventory/actions";
import type { DBItemCategory } from "@/types/db";

export interface CategoryDetailViewProps {
  category: DBItemCategory;
  itemCount: number;
  returnTo: string;
  canDelete: boolean;
}

function getSystemTypeLabel(type: string): string {
  switch (type) {
    case "RAW":
      return "Nguyên liệu";
    case "CONSUMABLE":
      return "Vật tư";
    case "EQUIPMENT":
      return "Dụng cụ";
    default:
      return type;
  }
}

export function CategoryDetailView({
  category,
  itemCount,
  returnTo,
  canDelete,
}: CategoryDetailViewProps) {
  const editHref = `/admin/inventory/categories/${encodeURIComponent(category.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`;

  const fields: Field[] = [
    { label: "Đặc tính", value: getSystemTypeLabel(category.system_type) },
    {
      label: "Số hàng hoá",
      value: (
        <div className="flex items-center gap-3">
          <span>{itemCount}</span>
          <Button
            href={`/admin/inventory/items?category=${encodeURIComponent(category.id)}`}
            variant="secondary"
          >
            Xem hàng hoá
          </Button>
        </div>
      ),
    },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button href={editHref} variant="secondary">
        Chỉnh sửa
      </Button>
      {canDelete && (
        <RemoveRecordButton
          verb="Xoá"
          name={category.name}
          confirmMessage={`Bạn có chắc chắn muốn xoá phân loại "${category.name}"?`}
          remove={async () => {
            const fd = new FormData();
            fd.append("id", category.id);
            const res = await deleteItemCategory(fd);
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
        backLabel="Phân loại hàng"
        title={category.name}
        subtitle={category.id}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
