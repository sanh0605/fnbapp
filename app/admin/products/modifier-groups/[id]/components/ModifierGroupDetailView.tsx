"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/Table";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import { formatNumber } from "@/lib/shared/format";
import {
  deleteModifierGroup,
  setModifierGroupStatus,
} from "@/app/admin/products/modifier-groups/actions";
import type { DBModifierGroup, DBModifier, DBProduct, DBProductCategory } from "@/types/db";

export interface ModifierGroupDetailViewProps {
  group: DBModifierGroup;
  options: DBModifier[];
  productIds: string[];
  allProducts: DBProduct[];
  allCategories: DBProductCategory[];
  canDelete: boolean;
  returnTo: string;
}

export function ModifierGroupDetailView({
  group,
  options,
  productIds,
  allProducts,
  allCategories,
  canDelete,
  returnTo,
}: ModifierGroupDetailViewProps) {
  const router = useRouter();
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const currentDetailUrl = `/admin/products/modifier-groups/${encodeURIComponent(group.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/products/modifier-groups/${encodeURIComponent(group.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  // Rule: Xoá shows only for ADMIN and only when the group has no option
  const showDelete = canDelete && options.length === 0;

  const categoriesById = useMemo(
    () => new Map(allCategories.map((c) => [c.id, c.name])),
    [allCategories]
  );

  const appliedProducts = useMemo(() => {
    const productSet = new Set(productIds);
    return allProducts.filter((p) => productSet.has(p.id));
  }, [allProducts, productIds]);

  const productsByCategory = useMemo(() => {
    const map = new Map<string, { id: string; categoryName: string; products: DBProduct[] }>();
    for (const p of appliedProducts) {
      const catId = p.category_id;
      const catName = categoriesById.get(p.category_id) || "Chưa phân loại";
      if (!map.has(catId)) {
        map.set(catId, { id: catId, categoryName: catName, products: [] });
      }
      map.get(catId)!.products.push(p);
    }
    return Array.from(map.values());
  }, [appliedProducts, categoriesById]);

  const fields: Field[] = [
    {
      label: "Kiểu chọn",
      value: group.selection_mode === "ONE" ? "Chọn một" : "Chọn nhiều",
    },
    {
      label: "Tối đa mấy phần",
      value:
        group.selection_mode === "ONE"
          ? "—"
          : group.max_total
          ? `${group.max_total} phần`
          : "Không giới hạn",
    },
    {
      label: "Cho bán riêng",
      value:
        group.selection_mode === "ONE"
          ? "Không"
          : group.allow_standalone
          ? "Có"
          : "Không",
    },
    { label: "Thứ tự hiện", value: String(group.sort_order) },
  ];

  async function handleDelete() {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const fd = new FormData();
      fd.append("id", group.id);
      const res = await deleteModifierGroup(fd);
      if (res?.error) {
        setDeleteError(res.error);
        setIsConfirmingDelete(false);
      } else {
        router.push(returnTo);
        router.refresh();
      }
    } catch {
      setDeleteError("Không xoá được. Kiểm tra mạng rồi bấm lại.");
      setIsConfirmingDelete(false);
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleStatus() {
    setStatusError(null);
    setIsTogglingStatus(true);
    try {
      const nextStatus = group.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const fd = new FormData();
      fd.append("id", group.id);
      fd.append("status", nextStatus);
      const res = await setModifierGroupStatus(fd);
      if (res?.error) {
        setStatusError(res.error);
      } else {
        router.refresh();
      }
    } catch {
      setStatusError("Không cập nhật được trạng thái. Kiểm tra mạng rồi bấm lại.");
    } finally {
      setIsTogglingStatus(false);
    }
  }

  const headerActions = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button href={editHref} variant="secondary">
          Chỉnh sửa
        </Button>
        <Button
          type="button"
          variant={group.status === "ACTIVE" ? "delete" : "secondary"}
          loading={isTogglingStatus}
          onClick={handleToggleStatus}
        >
          {group.status === "ACTIVE" ? "Ngừng dùng" : "Dùng lại"}
        </Button>
        {showDelete && !isConfirmingDelete && (
          <Button
            type="button"
            variant="delete"
            onClick={() => {
              setDeleteError(null);
              setIsConfirmingDelete(true);
            }}
          >
            Xoá
          </Button>
        )}
        {showDelete && isConfirmingDelete && (
          <div className="flex flex-wrap items-center gap-2 p-2 bg-surface-secondary border border-border rounded-lg">
            <span className="text-sm font-medium text-text-primary">
              Xoá nhóm tuỳ chọn này?
            </span>
            <Button
              type="button"
              variant="delete"
              loading={isDeleting}
              onClick={handleDelete}
            >
              Xoá
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={isDeleting}
              onClick={() => setIsConfirmingDelete(false)}
            >
              Bỏ
            </Button>
          </div>
        )}
      </div>
      {(deleteError || statusError) && (
        <Alert variant="danger">
          {deleteError || statusError}
        </Alert>
      )}
    </div>
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Nhóm tuỳ chọn"
        title={group.name}
        subtitle={group.id}
        badge={group.status !== "ACTIVE" ? <Badge variant="neutral">Ngừng dùng</Badge> : undefined}
        actions={headerActions}
      />

      <FieldList fields={fields} />

      {/* Section: Tuỳ chọn trong nhóm */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Tuỳ chọn trong nhóm ({options.length})
        </h2>

        {options.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa có tuỳ chọn nào trong nhóm này.
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Tên tuỳ chọn</TableHeaderCell>
                  <TableHeaderCell>Giá thêm</TableHeaderCell>
                  {group.selection_mode === "ONE" && (
                    <TableHeaderCell>Có sẵn</TableHeaderCell>
                  )}
                  {group.selection_mode === "MANY" && (
                    <TableHeaderCell>Tối đa mỗi món</TableHeaderCell>
                  )}
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {options.map((opt) => (
                    <TableRow key={opt.id}>
                      <TableCell>{opt.name}</TableCell>
                      <TableCell align="right">
                        {formatNumber(opt.price)}đ
                      </TableCell>
                      {group.selection_mode === "ONE" && (
                        <TableCell>
                          {opt.is_default ? "Có" : "Không"}
                        </TableCell>
                      )}
                      {group.selection_mode === "MANY" && (
                        <TableCell>
                          {opt.max_qty ? `${opt.max_qty}` : "Không giới hạn"}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={opt.status === "ACTIVE" ? "success" : "neutral"}>
                          {opt.status === "ACTIVE" ? "Đang dùng" : "Ngừng dùng"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden bg-surface-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {options.map((opt) => (
                <div key={opt.id} className="px-4 py-2.5">
                  <PhoneRow
                    title={opt.name}
                    value={`${formatNumber(opt.price)}đ`}
                    meta={
                      group.selection_mode === "ONE"
                        ? opt.is_default
                          ? "Có sẵn"
                          : undefined
                        : opt.max_qty
                        ? `Tối đa: ${opt.max_qty}`
                        : undefined
                    }
                    badge={
                      opt.status === "ACTIVE" ? undefined : (
                        <Badge variant="neutral">Ngừng dùng</Badge>
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section: Món áp dụng */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Món áp dụng ({appliedProducts.length})
        </h2>

        {appliedProducts.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa có món nào áp dụng nhóm tuỳ chọn này.
          </div>
        ) : (
          <div className="space-y-4">
            {productsByCategory.map(({ id, categoryName, products }) => (
              <div key={id} className="space-y-2">
                <div className="text-sm font-semibold text-text-secondary">
                  {categoryName} ({products.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {products.map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-surface-secondary text-text-primary border border-border"
                    >
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DetailFrame>
  );
}
