"use client";

import React from "react";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { formatDate } from "@/lib/shared/datetime";
import { deleteBrand } from "@/app/admin/brands/actions";
import type { DBBrand } from "@/types/db";

export interface BrandOutletItem {
  id: string;
  name: string;
}

export interface BrandDetailViewProps {
  brand: DBBrand;
  outlets: BrandOutletItem[];
  canDelete: boolean;
  returnTo: string;
}

export function BrandDetailView({
  brand,
  outlets,
  canDelete,
  returnTo,
}: BrandDetailViewProps): JSX.Element {
  const currentDetailUrl = `/admin/brands/${encodeURIComponent(brand.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/brands/${encodeURIComponent(brand.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const outletLinks =
    outlets.length === 0 ? (
      "—"
    ) : (
      <span>
        {outlets.map((outlet, idx) => (
          <React.Fragment key={outlet.id}>
            {idx > 0 && ", "}
            <Link
              href={`/admin/outlets/${encodeURIComponent(outlet.id)}`}
              className="text-primary hover:underline font-medium"
            >
              {outlet.name}
            </Link>
          </React.Fragment>
        ))}
      </span>
    );

  const fields: Field[] = [
    { label: "Mã", value: brand.id },
    { label: "Tên thương hiệu", value: brand.name },
    { label: "Mã đơn hàng", value: brand.code || "—" },
    {
      label: "Ngày bắt đầu",
      value: brand.start_date ? formatDate(brand.start_date) : "—",
    },
    { label: "Điểm bán", value: outletLinks },
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
          name={brand.name}
          confirmMessage={`Xoá thương hiệu "${brand.name}"?`}
          remove={async () => {
            const fd = new FormData();
            fd.append("id", brand.id);
            const res = await deleteBrand(fd);
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
        backLabel="Thương hiệu"
        title={brand.name}
        subtitle={brand.id}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
