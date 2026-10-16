"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import { formatDate, formatDateTimeFull } from "@/lib/shared/datetime";
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

function formatPromotionDate(val: string | null | undefined): string {
  if (!val) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return formatDate(val);
  return formatDateTimeFull(val);
}

export function PromotionDetailView({
  promo,
  brandName,
  applicableItems,
  canDelete,
  returnTo,
}: PromotionDetailViewProps) {
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
      label: "Dùng chung với khuyến mãi khác",
      value: promo.stackable ? "Có" : "Không",
    },
    {
      label: "Bắt đầu",
      value: formatPromotionDate(promo.start_date),
    },
    {
      label: "Kết thúc",
      value: formatPromotionDate(promo.end_date),
    },
    { label: "Trạng thái", value: statusBadge },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button href={editHref} variant="secondary">
        Chỉnh sửa
      </Button>
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
                <Table>
                  <TableHead>
                    <TableHeaderCell>Món</TableHeaderCell>
                    <TableHeaderCell>Size</TableHeaderCell>
                    <TableHeaderCell>Giá áp dụng</TableHeaderCell>
                  </TableHead>
                  <TableBody>
                    {applicableItems.map((item, idx) => (
                      <TableRow key={item.variantId || idx}>
                        <TableCell>
                          {item.dishName}
                        </TableCell>
                        <TableCell>
                          {item.sizeName}
                        </TableCell>
                        <TableCell align="right">
                          {item.appliedValue}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-border">
                {applicableItems.map((item, idx) => (
                  <div
                    key={item.variantId || idx}
                    className="px-4 py-2.5"
                  >
                    <PhoneRow
                      title={item.dishName}
                      value={item.appliedValue}
                      meta={item.sizeName}
                    />
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
