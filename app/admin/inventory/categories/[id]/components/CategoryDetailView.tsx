"use client";

import React from "react";
import Link from "next/link";
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
}: CategoryDetailViewProps): JSX.Element {
  const editHref = `/admin/inventory/categories/${encodeURIComponent(category.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`;

  const fields: Field[] = [
    { label: "Mã", value: category.id },
    { label: "Tên", value: category.name },
    { label: "Đặc tính", value: getSystemTypeLabel(category.system_type) },
    {
      label: "Số hàng hoá",
      value: (
        <div className="flex items-center gap-3">
          <span>{itemCount}</span>
          <Link
            href={`/admin/inventory/items?category=${encodeURIComponent(category.id)}`}
            className="text-primary hover:text-primary-hover font-medium text-xs underline"
          >
            Xem hàng hoá
          </Link>
        </div>
      ),
    },
  ];

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
