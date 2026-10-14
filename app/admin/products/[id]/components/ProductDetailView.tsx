"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import { formatNumber } from "@/lib/shared/format";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { confirm } from "@/lib/shared/dialog";
import { pauseProduct, resumeProduct, eraseProduct } from "@/app/admin/products/actions";

export interface ProductDetailViewProps {
  product: {
    id: string;
    name: string;
    category_id: string;
    status: string;
    image_url?: string;
    variants: any[];
    priceHistory: any[];
    neverSold: boolean;
    hasNoSellableVariant: boolean;
    isLinkedTopping?: boolean;
    [key: string]: any;
  };
  categoryName: string;
  returnTo: string;
  canDelete: boolean;
  linkedModifierId?: string | null;
  optionGroupNames?: string[];
}

export function ProductDetailView({
  product,
  categoryName,
  returnTo,
  canDelete,
  linkedModifierId,
  optionGroupNames,
}: ProductDetailViewProps): JSX.Element {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const statusLabel =
    product.status === "ACTIVE"
      ? "Đang bán"
      : product.status === "INACTIVE"
      ? "Ngừng bán"
      : "Đã xoá";

  const optionGroupsText =
    optionGroupNames && optionGroupNames.length > 0
      ? optionGroupNames.join(", ")
      : "—";

  const fields: Field[] = [
    { label: "Mã", value: product.id },
    { label: "Tên", value: product.name },
    { label: "Nhóm", value: categoryName || "—" },
    { label: "Nhóm tuỳ chọn", value: optionGroupsText },
    { label: "Trạng thái", value: statusLabel },
    {
      label: "Đã bán",
      value: product.neverSold ? "Chưa bán lần nào" : "Đã có đơn",
    },
  ];

  if (product.image_url) {
    fields.push({
      label: "Ảnh",
      value: (
        <div className="w-12 h-12 rounded-lg bg-page border border-border overflow-hidden shrink-0">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      ),
    });
  }

  const currentDetailUrl = `/admin/products/${encodeURIComponent(product.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/products/${encodeURIComponent(product.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  async function handlePause() {
    setActionError(null);
    const ok = await confirm({
      title: "Ngừng bán",
      message: `Ngừng bán món "${product.name}"? Món sẽ ẩn khỏi máy bán hàng.`,
      variant: "warning",
    });
    if (!ok) return;

    setIsPending(true);
    try {
      const fd = new FormData();
      fd.append("id", product.id);
      const res = await pauseProduct(fd);
      if (res?.error) {
        setActionError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  async function handleResume() {
    setActionError(null);
    setIsPending(true);
    try {
      const fd = new FormData();
      fd.append("id", product.id);
      const res = await resumeProduct(fd);
      if (res?.error) {
        setActionError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setIsPending(false);
    }
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button href={editHref} variant="secondary">
        Chỉnh sửa
      </Button>
      {product.status === "ACTIVE" ? (
        <Button
          type="button"
          variant="delete"
          disabled={isPending}
          onClick={handlePause}
        >
          Ngừng bán
        </Button>
      ) : product.status === "INACTIVE" ? (
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={handleResume}
        >
          Bán lại
        </Button>
      ) : null}
      {product.neverSold && canDelete && (
        <RemoveRecordButton
          verb="Xoá vĩnh viễn"
          name={product.name}
          confirmMessage={`Xoá vĩnh viễn món "${product.name}"? Toàn bộ lịch sử giá và size của món này sẽ mất theo. Việc này không thể hoàn tác.`}
          remove={async () => {
            const fd = new FormData();
            fd.append("id", product.id);
            const res = await eraseProduct(fd);
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

  const variants = product.variants || [];

  const sortedHistory = [...(product.priceHistory || [])].sort((a, b) => {
    const timeA = new Date(a.effective_at || a.created_at || 0).getTime();
    const timeB = new Date(b.effective_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Món"
        title={product.name}
        subtitle={product.id}
        badge={
          product.status === "INACTIVE" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-warning/10 text-warning border border-warning/20">
              Ngừng bán
            </span>
          ) : product.status === "DELETED" ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-secondary text-text-secondary border border-border">
              Đã xoá
            </span>
          ) : undefined
        }
        actions={headerActions}
      />

      {actionError && (
        <Alert variant="danger">
          {actionError}
        </Alert>
      )}

      <FieldList fields={fields} />

      {/* Section: Size & giá (N) */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold text-text-primary">
            Size & giá ({variants.length})
          </h2>
          {product.hasNoSellableVariant && (
            <Badge variant="danger">Không có size nào đang bán</Badge>
          )}
        </div>

        {variants.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa có size nào.
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Size</TableHeaderCell>
                  <TableHeaderCell>Giá bán</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {variants.map((v: any, idx: number) => (
                    <TableRow key={v.id || idx}>
                      <TableCell>{v.size_name}</TableCell>
                      <TableCell align="right">{formatNumber(v.price)}</TableCell>
                      <TableCell>
                        <Badge variant={v.status === "ACTIVE" ? "success" : "warning"}>
                          {v.status === "ACTIVE" ? "Đang bán" : "Ngừng bán"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden bg-surface-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {variants.map((v: any, idx: number) => (
                <div key={v.id || idx} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="text-text-primary text-sm">
                      {v.size_name}
                    </div>
                    <div className="text-sm text-primary tabular-nums">
                      {formatNumber(v.price)}
                    </div>
                  </div>
                  <Badge variant={v.status === "ACTIVE" ? "success" : "warning"}>
                    {v.status === "ACTIVE" ? "Đang bán" : "Ngừng bán"}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {product.isLinkedTopping && (
          <div className="text-sm text-text-secondary flex items-center gap-2 pt-1">
            <span>Giá của món này đặt ở trang Topping & tuỳ chọn.</span>
            <Link
              href={
                linkedModifierId
                  ? `/admin/products/modifiers/${encodeURIComponent(linkedModifierId)}`
                  : "/admin/products/modifiers"
              }
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Mở tuỳ chọn &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* Section: Lịch sử giá (N) */}
      <div id="lich-su-gia" className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">
          Lịch sử giá ({sortedHistory.length})
        </h2>

        {sortedHistory.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa có lịch sử giá.
          </div>
        ) : (
          <div>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Ngày áp dụng</TableHeaderCell>
                  <TableHeaderCell>Size</TableHeaderCell>
                  <TableHeaderCell>Giá cũ</TableHeaderCell>
                  <TableHeaderCell>Giá mới</TableHeaderCell>
                  <TableHeaderCell>Lý do</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {sortedHistory.map((entry: any, idx: number) => {
                    const variant = (product.variants || []).find(
                      (v: any) => v.id === entry.variant_id,
                    );
                    const sizeName = variant?.size_name || "—";
                    const oldPriceText =
                      entry.old_price === null ||
                      entry.old_price === undefined ||
                      entry.old_price === ""
                        ? "—"
                        : formatNumber(entry.old_price);
                    const dateText =
                      formatDateTimeFull(entry.effective_at || entry.created_at) || "—";
                    const reasonText = entry.reason || entry.note || "—";

                    return (
                      <TableRow key={entry.id || idx}>
                        <TableCell>
                          <span className="text-text-secondary font-mono text-xs">
                            {dateText}
                          </span>
                        </TableCell>
                        <TableCell>{sizeName}</TableCell>
                        <TableCell align="right">
                          <span className="text-text-muted">{oldPriceText}</span>
                        </TableCell>
                        <TableCell align="right">
                          {formatNumber(entry.new_price)}
                        </TableCell>
                        <TableCell>
                          <span className="text-text-secondary">{reasonText}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden bg-surface-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
              {sortedHistory.map((entry: any, idx: number) => {
                const variant = (product.variants || []).find(
                  (v: any) => v.id === entry.variant_id,
                );
                const sizeName = variant?.size_name || "—";
                const oldPriceText =
                  entry.old_price === null ||
                  entry.old_price === undefined ||
                  entry.old_price === ""
                    ? "—"
                    : formatNumber(entry.old_price);
                const dateText =
                  formatDateTimeFull(entry.effective_at || entry.created_at) || "—";
                const reasonText = entry.reason || entry.note || "—";

                return (
                  <div key={entry.id || idx} className="p-4 space-y-1">
                    <div className="flex justify-between items-start text-xs text-text-muted">
                      <span className="font-mono">{dateText}</span>
                      <span className="text-text-primary">{sizeName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-text-muted">{oldPriceText}</span>
                      <span className="text-text-muted">&rarr;</span>
                      <span className="text-text-primary tabular-nums">
                        {formatNumber(entry.new_price)}
                      </span>
                    </div>
                    {reasonText !== "—" && (
                      <div className="text-xs text-text-secondary italic">
                        {reasonText}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DetailFrame>
  );
}
