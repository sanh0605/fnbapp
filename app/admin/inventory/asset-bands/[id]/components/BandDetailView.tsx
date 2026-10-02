"use client";

import React from "react";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { formatBandRange } from "@/lib/assets/asset-depreciation";
import { deleteAssetBand } from "../../actions";
import type { DBAssetDepreciationBand } from "@/types/db";

export interface BandDetailViewProps {
  band: DBAssetDepreciationBand;
  returnTo: string;
  canDelete: boolean;
}

export function BandDetailView({
  band,
  returnTo,
  canDelete,
}: BandDetailViewProps): JSX.Element {
  const detailUrl = `/admin/inventory/asset-bands/${encodeURIComponent(band.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/inventory/asset-bands/${encodeURIComponent(band.id)}/edit?returnTo=${encodeURIComponent(detailUrl)}`;

  const fields: Field[] = [
    { label: "Mã", value: band.id },
    { label: "Đơn giá", value: formatBandRange(band) },
    { label: "Số tháng khấu hao", value: `${band.term_months} tháng` },
    { label: "Ghi chú", value: "Sửa khung chỉ áp dụng cho tài sản mua sau đó." },
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
          name={formatBandRange(band)}
          confirmMessage={`Bạn có chắc chắn muốn xoá khung "${formatBandRange(band)}"?`}
          remove={async () => {
            const fd = new FormData();
            fd.append("id", band.id);
            const res = await deleteAssetBand(fd);
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
        backLabel="Thời hạn khấu hao"
        title={formatBandRange(band)}
        subtitle={band.id}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
