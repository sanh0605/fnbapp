"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { confirm } from "@/lib/shared/dialog";
import { retireOutlet, reactivateOutlet } from "@/app/admin/outlets/actions";
import type { DBOutlet } from "@/types/db";

export interface OutletDetailViewProps {
  outlet: DBOutlet;
  brandName: string;
  returnTo: string;
}

export function OutletDetailView({
  outlet,
  brandName,
  returnTo,
}: OutletDetailViewProps) {
  const router = useRouter();
  const [retireLoading, setRetireLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentDetailUrl = `/admin/outlets/${encodeURIComponent(outlet.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/outlets/${encodeURIComponent(outlet.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const handleRetire = async () => {
    setActionError(null);
    const approved = await confirm({
      title: "Ngừng hoạt động điểm bán",
      message: `Ngừng hoạt động "${outlet.name}"? Điểm bán sẽ không còn dùng để mở máy POS, nhưng dữ liệu và mã ${outlet.code} vẫn được giữ nguyên.`,
      okText: "Ngừng hoạt động",
      cancelText: "Huỷ",
      variant: "warning",
    });
    if (!approved) return;

    setRetireLoading(true);
    try {
      const fd = new FormData();
      fd.set("id", outlet.id);
      const res = await retireOutlet(fd);
      if (res?.error) {
        setActionError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setRetireLoading(false);
    }
  };

  const handleReactivate = async () => {
    setActionError(null);
    const approved = await confirm({
      title: "Mở lại hoạt động điểm bán",
      message: `Mở lại hoạt động "${outlet.name}"? Điểm bán sẽ có thể tiếp tục dùng để mở máy POS và nhận đơn.`,
      okText: "Mở lại hoạt động",
      cancelText: "Huỷ",
      variant: "warning",
    });
    if (!approved) return;

    setReactivateLoading(true);
    try {
      const fd = new FormData();
      fd.set("id", outlet.id);
      const res = await reactivateOutlet(fd);
      if (res?.error) {
        setActionError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setReactivateLoading(false);
    }
  };

  const hoursText =
    outlet.open_time && outlet.close_time
      ? `${outlet.open_time.slice(0, 5)} - ${outlet.close_time.slice(0, 5)}`
      : "Chưa đặt";

  const brandLink = (
    <Link
      href={`/admin/brands/${encodeURIComponent(outlet.brand_id)}`}
      className="text-primary underline underline-offset-2 font-medium"
    >
      {brandName}
    </Link>
  );

  const statusBadge =
    outlet.status === "ACTIVE" ? (
      <Badge variant="success">Đang hoạt động</Badge>
    ) : (
      <Badge variant="warning">Ngừng hoạt động</Badge>
    );

  const fields: Field[] = [
    { label: "Mã", value: outlet.id },
    { label: "Tên", value: outlet.name },
    { label: "Mã đơn", value: outlet.code },
    { label: "Thương hiệu", value: brandLink },
    { label: "Địa chỉ", value: outlet.address || "—" },
    { label: "Giờ hoạt động", value: hoursText },
    {
      label: "Bắt đầu",
      value: formatDateTimeFull(outlet.start_date) || "—",
    },
    {
      label: "Kết thúc",
      value: formatDateTimeFull(outlet.end_date) || "—",
    },
    { label: "Trạng thái", value: statusBadge },
  ];

  const headerActions = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button href={editHref} variant="secondary">
          Chỉnh sửa
        </Button>
        {outlet.status === "ACTIVE" ? (
          <Button
            type="button"
            variant="delete"
            onClick={handleRetire}
            loading={retireLoading}
          >
            Ngừng hoạt động
          </Button>
        ) : outlet.status === "INACTIVE" ? (
          <Button
            type="button"
            variant="secondary"
            onClick={handleReactivate}
            loading={reactivateLoading}
          >
            Mở lại hoạt động
          </Button>
        ) : null}
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
        backLabel="Điểm bán"
        title={outlet.name}
        badge={outlet.status !== "ACTIVE" ? <Badge variant="warning">Ngừng hoạt động</Badge> : undefined}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
