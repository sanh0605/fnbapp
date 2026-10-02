"use client";

import React from "react";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { deleteUnit } from "@/app/admin/inventory/actions";
import type { DBUnit } from "@/types/db";

export interface UnitDetailViewProps {
  unit: DBUnit;
  returnTo: string;
  canDelete: boolean;
}

export function UnitDetailView({
  unit,
  returnTo,
  canDelete,
}: UnitDetailViewProps): JSX.Element {
  const editHref = `/admin/inventory/units/${encodeURIComponent(unit.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`;

  const fields: Field[] = [
    { label: "Mã", value: unit.id },
    { label: "Tên", value: unit.name },
    { label: "Ghi chú", value: unit.description || "—" },
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
          name={unit.name}
          confirmMessage={`Bạn có chắc chắn muốn xoá đơn vị "${unit.name}"?`}
          remove={async () => {
            const fd = new FormData();
            fd.append("id", unit.id);
            const res = await deleteUnit(fd);
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
        backLabel="Đơn vị tính"
        title={unit.name}
        subtitle={unit.id}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
