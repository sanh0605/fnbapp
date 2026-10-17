"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { PurchaseHistoryView } from "./PurchaseHistoryView";
import { confirm } from "@/lib/shared/dialog";
import { deletePurchasedItemAction, setPurchasedItemStatus } from "../../actions";
import type { DBPurchasedItem, DBItemCategory, DBUOMConversion, DBUnit } from "@/types/db";
import type { ItemPurchaseHistoryRow } from "@/lib/purchasing/item-purchase-history";
import type { ItemStockDisplay } from "@/lib/stock/item-stock-display";
import { formatNumber } from "@/lib/shared/format";

export interface ItemDetailViewProps {
  item: DBPurchasedItem;
  category?: DBItemCategory;
  conversions: DBUOMConversion[];
  units: DBUnit[];
  purchaseHistory: ItemPurchaseHistoryRow[];
  stock?: ItemStockDisplay;
  returnTo: string;
  canDelete: boolean;
}

function getUnitName(unitIdOrName: string | undefined, units: DBUnit[]): string {
  if (!unitIdOrName) return "";
  const found = units.find((u) => u.id === unitIdOrName || u.name === unitIdOrName);
  return found?.name || unitIdOrName;
}

export function ItemDetailView({
  item,
  category,
  conversions,
  units,
  purchaseHistory,
  stock,
  returnTo,
  canDelete,
}: ItemDetailViewProps) {
  const router = useRouter();
  const [statusError, setStatusError] = useState<string | null>(null);
  const [isStatusPending, setIsStatusPending] = useState(false);

  const isInactive = item.status === "INACTIVE";

  async function handleToggleStatus() {
    setStatusError(null);
    if (!isInactive) {
      const ok = await confirm({
        title: "Ngừng dùng",
        message: `Ngừng dùng ${item.name}? Phiếu nhập mới sẽ không chọn được hàng này; phiếu xuất và kiểm kê vẫn dùng được.`,
        variant: "danger",
      });
      if (!ok) return;
    }

    setIsStatusPending(true);
    try {
      const fd = new FormData();
      fd.append("id", item.id);
      fd.append("status", isInactive ? "ACTIVE" : "INACTIVE");
      const res = await setPurchasedItemStatus(fd);
      if (res?.error) {
        setStatusError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setIsStatusPending(false);
    }
  }

  const isNonInventory =
    item.is_non_inventory === true || (item.is_non_inventory as any) === "true";

  let stockValue: React.ReactNode = "—";
  if (stock) {
    if (stock.kind === "equipment") {
      stockValue = (
        <Link
          href={`/admin/inventory/assets?q=${encodeURIComponent(item.id)}`}
          className="text-sm font-medium text-primary hover:text-primary-hover min-h-[48px] md:min-h-[40px] inline-flex items-center"
        >
          Xem ở Tài sản
        </Link>
      );
    } else {
      stockValue = stock.text;
    }
  }

  const fields: Field[] = [
    { label: "Phân loại", value: category?.name || "—" },
    { label: "Tính tồn kho", value: isNonInventory ? "Không" : "Có" },
    { label: "Tồn kho hiện tại", value: stockValue },
    {
      label: "Trạng thái",
      value: item.status === "INACTIVE" ? "Ngừng dùng" : "Đang dùng",
    },
  ];

  const editHref = `/admin/inventory/items/${encodeURIComponent(item.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`;

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button href={editHref} variant="secondary">
        Chỉnh sửa
      </Button>
      <Button
        type="button"
        variant={isInactive ? "secondary" : "delete"}
        loading={isStatusPending}
        onClick={handleToggleStatus}
      >
        {isInactive ? "Dùng lại" : "Ngừng dùng"}
      </Button>
      {canDelete && (
        <RemoveRecordButton
          verb="Xoá"
          name={item.name}
          confirmMessage={`Bạn có chắc chắn muốn xoá hàng hoá "${item.name}"?`}
          remove={async () => {
            const fd = new FormData();
            fd.append("id", item.id);
            const res = await deletePurchasedItemAction(fd);
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
        backLabel="Hàng hoá"
        title={item.name}
        subtitle={item.id}
        badge={
          item.status === "INACTIVE" ? (
            <Badge variant="neutral">
              Ngừng dùng
            </Badge>
          ) : undefined
        }
        actions={headerActions}
      />

      {statusError && (
        <Alert variant="danger">
          {statusError}
        </Alert>
      )}

      <FieldList fields={fields} />

      {/* Section: Quy đổi (N) */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-text-primary">
            Quy đổi ({conversions.length})
          </h2>
          <Link
            href={`/admin/inventory/conversions?q=${encodeURIComponent(item.name)}`}
            className="text-sm font-medium text-primary hover:text-primary-hover min-h-[48px] md:min-h-[40px] inline-flex items-center"
          >
            Xem trong Bảng quy đổi &rarr;
          </Link>
        </div>

        {conversions.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa có quy đổi nào.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHead>
                  <TableHeaderCell>Đơn vị mua</TableHeaderCell>
                  <TableHeaderCell>Hệ số</TableHeaderCell>
                  <TableHeaderCell>Đơn vị gốc</TableHeaderCell>
                  <TableHeaderCell>Trạng thái</TableHeaderCell>
                </TableHead>
                <TableBody>
                  {conversions.map((conv) => (
                    <TableRow key={conv.id}>
                      <TableCell>
                        {getUnitName(conv.purchased_unit, units)}
                      </TableCell>
                      <TableCell align="right">
                        {formatNumber(conv.conversion_rate)}
                      </TableCell>
                      <TableCell>
                        {getUnitName(conv.base_unit, units)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={conv.status === "INACTIVE" ? "neutral" : "processing"}
                        >
                          {conv.status === "INACTIVE" ? "Ngừng dùng" : "Đang dùng"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Phone Rows */}
            <div className="md:hidden divide-y divide-border bg-surface-card rounded-card border border-border">
              {conversions.map((conv) => (
                <div key={conv.id} className="px-4 py-2.5">
                  <PhoneRow
                    title={`1 ${getUnitName(conv.purchased_unit, units)} = ${formatNumber(conv.conversion_rate)} ${getUnitName(conv.base_unit, units)}`}
                    badge={
                      <Badge
                        variant={conv.status === "INACTIVE" ? "neutral" : "processing"}
                      >
                        {conv.status === "INACTIVE" ? "Ngừng dùng" : "Đang dùng"}
                      </Badge>
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section: Lịch sử nhập */}
      <div className="space-y-4 pt-2">
        <h2 className="text-xl font-bold text-text-primary">Lịch sử nhập</h2>
        <PurchaseHistoryView rows={purchaseHistory} itemName={item.name} />
      </div>
    </DetailFrame>
  );
}
