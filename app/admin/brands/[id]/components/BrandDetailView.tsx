"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { formatDateTimeFull } from "@/lib/shared/datetime";
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
}: BrandDetailViewProps) {
  const currentDetailUrl = `/admin/brands/${encodeURIComponent(brand.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/brands/${encodeURIComponent(brand.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const outletLinks =
    outlets.length === 0 ? (
      "—"
    ) : (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-6 md:gap-y-5">
        {outlets.map((outlet, idx) => (
          <span key={outlet.id} className="inline-flex items-center">
            <Link
              href={`/admin/outlets/${encodeURIComponent(outlet.id)}`}
              className="inline-flex items-center min-h-[48px] md:min-h-[40px] -my-3 md:-my-2.5 text-primary underline underline-offset-2 font-medium"
            >
              {outlet.name}
            </Link>
            {idx < outlets.length - 1 && ","}
          </span>
        ))}
      </span>
    );

  const fields: Field[] = [
    { label: "Mã đơn hàng", value: brand.code || "—" },
    {
      label: "Ngày bắt đầu",
      value: formatDateTimeFull(brand.start_date) || "—",
    },
    { label: "Điểm bán", value: outletLinks },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button href={editHref} variant="secondary">
        Chỉnh sửa
      </Button>
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
