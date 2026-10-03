"use client";

import React from "react";
import Link from "next/link";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { Badge } from "@/components/ui/Badge";
import { deleteCategory } from "@/app/admin/products/categories/actions";
import type { DBProductCategory } from "@/types/db";

export interface DishItem {
  id: string;
  name: string;
  status: string;
}

export interface ProductCategoryDetailViewProps {
  category: DBProductCategory;
  dishCount?: number;
  dishes: DishItem[];
  returnTo: string;
}

export function ProductCategoryDetailView({
  category,
  dishCount,
  dishes,
  returnTo,
}: ProductCategoryDetailViewProps): JSX.Element {
  const currentDetailUrl = `/admin/products/categories/${encodeURIComponent(category.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/products/categories/${encodeURIComponent(category.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;
  const count = dishCount !== undefined ? dishCount : dishes.length;

  const fields: Field[] = [
    { label: "Mã", value: category.id },
    { label: "Tên nhóm", value: category.name },
    { label: "Số món", value: `${count} món` },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={editHref}
        className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm min-h-[44px] flex items-center justify-center text-sm"
      >
        Chỉnh sửa
      </Link>
      <RemoveRecordButton
        verb="Xoá"
        name={category.name}
        confirmMessage={`Xoá nhóm món "${category.name}"?`}
        remove={async () => {
          const fd = new FormData();
          fd.append("id", category.id);
          const res = await deleteCategory(fd);
          if (res?.error) {
            return { error: res.error };
          }
          return {};
        }}
        afterHref={returnTo}
      />
    </div>
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Nhóm món"
        title={category.name}
        subtitle={category.id}
        actions={headerActions}
      />

      <FieldList fields={fields} />

      {/* Section: Món trong nhóm (N) */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Món trong nhóm ({dishes.length})
        </h2>

        {dishes.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa có món nào trong nhóm này.
          </div>
        ) : (
          <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4 font-bold">Mã</th>
                    <th className="px-6 py-4 font-bold">Tên</th>
                    <th className="px-6 py-4 font-bold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dishes.map((dish) => (
                    <tr
                      key={dish.id}
                      className="hover:bg-surface-secondary/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-mono text-[11px] text-text-muted font-bold">
                        <Link
                          href={`/admin/products/${encodeURIComponent(dish.id)}`}
                          className="hover:text-primary transition-colors block"
                        >
                          {dish.id}
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-bold text-text-primary">
                        <Link
                          href={`/admin/products/${encodeURIComponent(dish.id)}`}
                          className="hover:text-primary transition-colors block"
                        >
                          {dish.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={dish.status === "ACTIVE" ? "success" : "warning"}>
                          {dish.status === "ACTIVE" ? "Đang bán" : "Ngừng bán"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {dishes.map((dish) => (
                <Link
                  key={dish.id}
                  href={`/admin/products/${encodeURIComponent(dish.id)}`}
                  className="p-4 flex items-center justify-between hover:bg-surface-secondary/50 transition-colors"
                >
                  <div>
                    <div className="font-bold text-text-primary text-sm">
                      {dish.name}
                    </div>
                    <div className="font-mono text-[11px] text-text-muted mt-0.5 font-bold">
                      {dish.id}
                    </div>
                  </div>
                  <Badge variant={dish.status === "ACTIVE" ? "success" : "warning"}>
                    {dish.status === "ACTIVE" ? "Đang bán" : "Ngừng bán"}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DetailFrame>
  );
}
