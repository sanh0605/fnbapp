"use client";

import React from "react";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { deletePromotionAction } from "@/app/admin/promotions/actions";
import type { DBPromotion } from "@/types/db";

export interface ApplicableProductItem {
  variantId: string;
  dishName: string;
  sizeName: string;
  appliedValue: string;
}

export interface PromotionDetailViewProps {
  promo: DBPromotion;
  brandName: string;
  applicableItems: ApplicableProductItem[];
  canDelete: boolean;
  returnTo: string;
}

function isExpired(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  const t = new Date(endDate).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

export function PromotionDetailView({
  promo,
  brandName,
  applicableItems,
  canDelete,
  returnTo,
}: PromotionDetailViewProps): JSX.Element {
  const currentDetailUrl = `/admin/promotions/${encodeURIComponent(promo.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/promotions/${encodeURIComponent(promo.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const expired = isExpired(promo.end_date);
  const statusBadge = expired ? (
    <Badge variant="danger">Đã hết hạn</Badge>
  ) : promo.status === "INACTIVE" ? (
    <Badge variant="warning">Tạm ngưng</Badge>
  ) : (
    <Badge variant="success">Đang chạy</Badge>
  );

  let discountLabel = "";
  if (promo.discount_type === "PERCENT") {
    discountLabel = `Giảm ${promo.discount_value}%`;
  } else if (promo.discount_type === "FLAT_PRICE") {
    discountLabel = `Đồng giá ${formatNumber(promo.discount_value)}đ`;
  } else {
    discountLabel = `Giảm ${formatNumber(promo.discount_value)}đ`;
  }

  const fields: Field[] = [
    { label: "Mã", value: promo.id },
    { label: "Tên", value: promo.name },
    { label: "Thương hiệu", value: brandName },
    {
      label: "Loại",
      value: promo.type === "ORDER_DISCOUNT" ? "Giảm đơn hàng" : "Giảm theo món",
    },
    { label: "Mức giảm", value: discountLabel },
    { label: "Mã giảm giá", value: promo.code || "Tự động áp dụng" },
    {
      label: "Đơn tối thiểu",
      value:
        Number(promo.min_order_value) > 0
          ? `${formatNumber(promo.min_order_value)}đ`
          : "—",
    },
    {
      label: "Bắt đầu",
      value: promo.start_date ? formatDateTime(promo.start_date) : "—",
    },
    {
      label: "Kết thúc",
      value: promo.end_date ? formatDateTime(promo.end_date) : "—",
    },
    { label: "Trạng thái", value: statusBadge },
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
          name={promo.name}
          confirmMessage={`Xoá khuyến mãi "${promo.name}"? Việc này không thể hoàn tác.`}
          remove={async () => {
            const res = await deletePromotionAction(promo.id);
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
        backLabel="Khuyến mãi"
        title={promo.name}
        subtitle={promo.id}
        badge={statusBadge}
        actions={headerActions}
      />

      <FieldList fields={fields} />

      {promo.type === "PRODUCT_DISCOUNT" && (
        <div className="space-y-4 pt-2">
          <h2 className="text-xl font-bold text-text-primary">
            Món áp dụng ({applicableItems.length})
          </h2>

          {applicableItems.length === 0 ? (
            <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
              Chưa có món nào được áp dụng.
            </div>
          ) : (
            <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                      <th className="px-6 py-4 font-bold">Món</th>
                      <th className="px-6 py-4 font-bold">Size</th>
                      <th className="px-6 py-4 font-bold">Giá áp dụng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {applicableItems.map((item, idx) => (
                      <tr
                        key={item.variantId || idx}
                        className="hover:bg-surface-secondary/50 transition-colors"
                      >
                        <td className="px-6 py-4 font-bold text-text-primary">
                          {item.dishName}
                        </td>
                        <td className="px-6 py-4 text-text-secondary">
                          {item.sizeName}
                        </td>
                        <td className="px-6 py-4 font-semibold text-text-primary">
                          {item.appliedValue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-border">
                {applicableItems.map((item, idx) => (
                  <div
                    key={item.variantId || idx}
                    className="p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-text-primary text-sm">
                        {item.dishName}
                      </div>
                      <div className="text-xs text-text-muted mt-0.5">
                        {item.sizeName}
                      </div>
                    </div>
                    <div className="font-semibold text-text-primary text-sm">
                      {item.appliedValue}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DetailFrame>
  );
}
