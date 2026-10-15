"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { formatBandRange } from "@/lib/assets/asset-depreciation";
import type { DBAssetDepreciationBand } from "@/types/db";

export interface BandDetailViewProps {
  band: DBAssetDepreciationBand;
  returnTo: string;
}

export function BandDetailView({
  band,
  returnTo,
}: BandDetailViewProps) {
  const detailUrl = `/admin/inventory/asset-bands/${encodeURIComponent(band.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/inventory/asset-bands/edit?returnTo=${encodeURIComponent(detailUrl)}`;

  const fields: Field[] = [
    { label: "Mã", value: band.id },
    { label: "Đơn giá", value: formatBandRange(band) },
    { label: "Số tháng khấu hao", value: `${band.term_months} tháng` },
    { label: "Ghi chú", value: "Sửa khung chỉ áp dụng cho tài sản mua sau đó." },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button href={editHref} variant="secondary">
        Sửa
      </Button>
    </div>
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Thời hạn khấu hao"
        title={formatBandRange(band)}
        subtitle={band.id}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
