"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/shared/datetime";
import { confirm } from "@/lib/shared/dialog";
import { retireOutlet } from "@/app/admin/outlets/actions";
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
}: OutletDetailViewProps): JSX.Element {
  const router = useRouter();
  const [retireLoading, setRetireLoading] = useState(false);
  const [retireError, setRetireError] = useState<string | null>(null);

  const currentDetailUrl = `/admin/outlets/${encodeURIComponent(outlet.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/outlets/${encodeURIComponent(outlet.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const handleRetire = async () => {
    setRetireError(null);
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
        setRetireError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setRetireLoading(false);
    }
  };

  const hoursText =
    outlet.open_time && outlet.close_time
      ? `${outlet.open_time.slice(0, 5)} - ${outlet.close_time.slice(0, 5)}`
      : "Chưa đặt";

  const brandLink = (
    <Link
      href={`/admin/brands/${encodeURIComponent(outlet.brand_id)}`}
      className="text-primary hover:underline font-medium"
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
      value: outlet.start_date ? formatDate(outlet.start_date) : "—",
    },
    {
      label: "Kết thúc",
      value: outlet.end_date ? formatDate(outlet.end_date) : "—",
    },
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
        {outlet.status === "ACTIVE" && (
          <button
            type="button"
            onClick={handleRetire}
            disabled={retireLoading}
            className="px-4 py-2 text-sm font-medium text-danger border border-danger/30 rounded-lg hover:bg-danger/10 transition min-h-[44px] flex items-center justify-center disabled:opacity-50"
          >
            {retireLoading ? "Đang xử lý..." : "Ngừng hoạt động"}
          </button>
        )}
      </div>
      {retireError && (
        <div
          role="alert"
          className="text-sm font-medium text-danger bg-danger/10 border border-danger/20 rounded-lg p-3"
        >
          {retireError}
        </div>
      )}
    </div>
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Điểm bán"
        title={outlet.name}
        subtitle={outlet.id}
        badge={outlet.status !== "ACTIVE" ? <Badge variant="warning">Ngừng hoạt động</Badge> : undefined}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
