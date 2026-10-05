"use client";

import React from "react";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { deleteConversionAction } from "@/app/admin/inventory/conversions/actions";
import type { DBUOMConversion, DBPurchasedItem, DBUnit } from "@/types/db";

export interface ConversionDetailViewProps {
  conversion: DBUOMConversion;
  item?: DBPurchasedItem;
  units?: DBUnit[];
  purchaseOrderLinesCount: number;
  returnTo: string;
  canDelete: boolean;
}

export function ConversionDetailView({
  conversion,
  item,
  units,
  purchaseOrderLinesCount,
  returnTo,
  canDelete,
}: ConversionDetailViewProps): JSX.Element {
  const isUsed = purchaseOrderLinesCount > 0;
  const verb = isUsed ? "Ngừng dùng" : "Xoá";
  const confirmMsg = isUsed
    ? "Ngừng dùng quy đổi này? Phiếu nhập cũ vẫn giữ nguyên."
    : `Bạn có chắc chắn muốn xoá quy đổi này?`;

  const editHref = `/admin/inventory/conversions/${encodeURIComponent(conversion.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`;

  const purchasedUnitName = units
    ? units.find((u) => u.id === conversion.purchased_unit)?.name ||
      conversion.purchased_unit
    : conversion.purchased_unit;

  const baseUnitName = units
    ? units.find((u) => u.id === conversion.base_unit)?.name ||
      conversion.base_unit
    : conversion.base_unit;

  const fields: Field[] = [
    { label: "Mã", value: conversion.id },
    {
      label: "Hàng hoá",
      value: (
        <Link
          href={`/admin/inventory/items/${encodeURIComponent(item?.id || conversion.purchased_item_id)}`}
          className="text-primary hover:text-primary-hover font-medium underline"
        >
          {item?.name || conversion.purchased_item_id}
        </Link>
      ),
    },
    { label: "Đơn vị mua", value: purchasedUnitName },
    { label: "Hệ số", value: String(conversion.conversion_rate) },
    { label: "Đơn vị gốc", value: baseUnitName },
    {
      label: "Chỉ cách mua",
      value: conversion.purchase_only ? "Có" : "Không",
    },
    {
      label: "Trạng thái",
      value: conversion.status === "INACTIVE" ? "Ngừng dùng" : "Đang dùng",
    },
    {
      label: "Dùng trong phiếu nhập",
      value: `${purchaseOrderLinesCount} dòng`,
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
      {canDelete && conversion.status !== "INACTIVE" && (
        <RemoveRecordButton
          verb={verb}
          name={item?.name || conversion.id}
          confirmMessage={confirmMsg}
          remove={async () => {
            const fd = new FormData();
            fd.append("id", conversion.id);
            const res = await deleteConversionAction(fd);
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
        backLabel="Bảng quy đổi"
        title={item?.name || conversion.id}
        subtitle={conversion.id}
        badge={
          conversion.status === "INACTIVE" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-secondary text-text-secondary border border-border">
              Ngừng dùng
            </span>
          ) : undefined
        }
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
