"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { formatNumber } from "@/lib/shared/format";
import { confirm } from "@/lib/shared/dialog";
import { deleteModifierAction, setModifierStatus } from "@/app/admin/products/modifiers/actions";
import type { DBModifier } from "@/types/db";

export interface LinkedProduct {
  id: string;
  name: string;
  status: string;
}

export interface ModifierDetailViewProps {
  modifier: DBModifier;
  product: LinkedProduct | null;
  groupName: string;
  allowStandalone: boolean;
  groupSelectionMode?: "ONE" | "MANY";
  canDelete: boolean;
  returnTo: string;
}

export function ModifierDetailView({
  modifier,
  product,
  groupName,
  allowStandalone,
  groupSelectionMode,
  canDelete,
  returnTo,
}: ModifierDetailViewProps) {
  const router = useRouter();
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStatusPending, setIsStatusPending] = useState(false);

  const isInactive = modifier.status === "INACTIVE";

  async function handleToggleStatus() {
    setStatusError(null);
    if (!isInactive) {
      const message =
        product && product.status === "ACTIVE"
          ? `Ngừng "${modifier.name}"? Máy bán hàng sẽ không còn hiện nó ở phần thêm topping lẫn món bán riêng ${product.name}.`
          : `Ngừng dùng tuỳ chọn "${modifier.name}"? Máy bán hàng sẽ không còn hiện tuỳ chọn này.`;
      const ok = await confirm({
        title: "Ngừng dùng",
        message,
        variant: "danger",
      });
      if (!ok) return;
    }

    setIsStatusPending(true);
    try {
      const fd = new FormData();
      fd.append("id", modifier.id);
      fd.append("status", isInactive ? "ACTIVE" : "INACTIVE");
      const res = await setModifierStatus(fd);
      if (res?.error) {
        setStatusError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setIsStatusPending(false);
    }
  }

  const currentDetailUrl = `/admin/products/modifiers/${encodeURIComponent(modifier.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/products/modifiers/${encodeURIComponent(modifier.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const displayGroupName = groupName || "—";
  const isOne = groupSelectionMode === "ONE";

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button href={editHref} variant="secondary">
        Chỉnh sửa
      </Button>
      <Button
        type="button"
        variant={isInactive ? "secondary" : "delete"}
        loading={isStatusPending}
        onClick={handleToggleStatus}
      >
        {isInactive ? "Dùng lại" : "Ngừng dùng"}
      </Button>
      {canDelete && (
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
      )}
    </div>
  );

  const fields: Field[] = [
    { label: "Nhóm", value: displayGroupName },
    { label: "Giá thêm", value: `${formatNumber(modifier.price)}đ` },
    {
      label: "Trạng thái",
      value: modifier.status === "INACTIVE" ? "Ngừng dùng" : "Đang dùng",
    },
    ...(isOne
      ? [{ label: "Có sẵn", value: modifier.is_default ? "Có" : "Không" }]
      : []),
    ...(!isOne
      ? [
          {
            label: "Tối đa mỗi món",
            value:
              modifier.max_qty !== null &&
              modifier.max_qty !== undefined &&
              modifier.max_qty > 0
                ? String(modifier.max_qty)
                : "Không giới hạn",
          },
        ]
      : []),
    {
      label: "Bán độc lập",
      value:
        isOne || !allowStandalone
          ? "—"
          : product && product.status === "ACTIVE"
          ? "Có"
          : "Không",
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
        badge={
          modifier.status === "INACTIVE" ? (
            <Badge variant="neutral">
              Ngừng dùng
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
    </DetailFrame>
  );
}
