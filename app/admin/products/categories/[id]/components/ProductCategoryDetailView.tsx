"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import { deleteCategory } from "@/app/admin/products/categories/actions";
import type { DBProductCategory } from "@/types/db";

export interface DishItem {
  id: string;
  name: string;
  status: string;
}

export interface ProductCategoryDetailViewProps {
  category: DBProductCategory;
  typeName?: string;
  dishCount?: number;
  dishes: DishItem[];
  canDelete?: boolean;
  returnTo: string;
}

export function ProductCategoryDetailView({
  category,
  typeName,
  dishCount,
  dishes,
  canDelete = false,
  returnTo,
}: ProductCategoryDetailViewProps) {
  const currentDetailUrl = `/admin/products/categories/${encodeURIComponent(category.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/products/categories/${encodeURIComponent(category.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;
  const count = dishCount !== undefined ? dishCount : dishes.length;

  const fields: Field[] = [
    { label: "Loại món", value: typeName || "—" },
  ];

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button href={editHref} variant="secondary">
        Chỉnh sửa
      </Button>
      {canDelete && count === 0 && (
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
      )}
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
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Mã</TableHeaderCell>
                  <TableHeaderCell>Tên</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {dishes.map((dish) => (
                    <TableRow key={dish.id}>
                      <TableCell>
                        <Link
                          href={`/admin/products/${encodeURIComponent(dish.id)}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {dish.id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/products/${encodeURIComponent(dish.id)}`}
                          className="hover:text-primary transition-colors"
                        >
                          {dish.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={dish.status === "ACTIVE" ? "success" : "neutral"}>
                          {dish.status === "ACTIVE" ? "Đang bán" : "Ngừng bán"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden bg-surface-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {dishes.map((dish) => (
                <Link
                  key={dish.id}
                  href={`/admin/products/${encodeURIComponent(dish.id)}`}
                  className="block px-4 py-2.5 hover:bg-surface-secondary/50 transition-colors min-h-[48px] md:min-h-[40px]"
                >
                  <PhoneRow
                    title={dish.name}
                    meta={dish.id}
                    badge={
                      dish.status === "ACTIVE" ? undefined : (
                        <Badge variant="neutral">Ngừng bán</Badge>
                      )
                    }
                  />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </DetailFrame>
  );
}
