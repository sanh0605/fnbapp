"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { formatNumber } from "@/lib/shared/format";
import { deleteModifierAction } from "@/app/admin/products/modifiers/actions";
import { StandaloneToppingSwitch } from "@/app/admin/products/modifiers/components/StandaloneToppingSwitch";
import type { DBModifier } from "@/types/db";

export interface LinkedProduct {
  id: string;
  name: string;
  status: string;
}

export interface ModifierDetailViewProps {
  modifier: DBModifier;
  product: LinkedProduct | null;
  returnTo: string;
}

export function ModifierDetailView({
  modifier,
  product,
  returnTo,
}: ModifierDetailViewProps): JSX.Element {
  const currentDetailUrl = `/admin/products/modifiers/${encodeURIComponent(modifier.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/products/modifiers/${encodeURIComponent(modifier.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button href={editHref} variant="secondary">
        Chỉnh sửa
      </Button>
      <RemoveRecordButton
        verb="Xoá"
        name={modifier.name}
        confirmMessage={`Xoá tuỳ chọn "${modifier.name}"?`}
        remove={async () => {
          const fd = new FormData();
          fd.append("id", modifier.id);
          const res = await deleteModifierAction(fd);
          if (res?.error) {
            return { error: res.error };
          }
          return {};
        }}
        afterHref={returnTo}
      />
    </div>
  );

  const fields: Field[] = [
    { label: "Mã", value: modifier.id },
    { label: "Nhóm", value: modifier.group_name },
    { label: "Tên tuỳ chọn", value: modifier.name },
    { label: "Giá thêm", value: formatNumber(modifier.price) },
    {
      label: "Bán độc lập",
      value: (
        <StandaloneToppingSwitch
          modifierId={modifier.id}
          modifierName={modifier.name}
          groupName={modifier.group_name}
          price={modifier.price}
          productId={modifier.product_id ?? null}
          productStatus={product?.status}
        />
      ),
    },
    {
      label: "Món liên kết",
      value: product ? (
        <Link
          href={`/admin/products/${encodeURIComponent(product.id)}`}
          className="text-primary hover:underline"
        >
          {product.name}
        </Link>
      ) : (
        "—"
      ),
    },
  ];

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Topping & tuỳ chọn"
        title={modifier.name}
        subtitle={modifier.id}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
