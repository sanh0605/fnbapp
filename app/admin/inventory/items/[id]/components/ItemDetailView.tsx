"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Table, TableHead, TableHeaderCell, TableBody, TableRow, TableCell } from "@/components/ui/Table";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { PurchaseHistoryView } from "./PurchaseHistoryView";
import { deletePurchasedItemAction } from "../../actions";
import type { DBPurchasedItem, DBItemCategory, DBUOMConversion, DBUnit } from "@/types/db";
import type { ItemPurchaseHistoryRow } from "@/lib/purchasing/item-purchase-history";
import type { ItemStockDisplay } from "@/lib/stock/item-stock-display";

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
  const isNonInventory =
    item.is_non_inventory === true || (item.is_non_inventory as any) === "true";

  let stockValue: React.ReactNode = "—";
  if (stock) {
    if (stock.kind === "equipment") {
      stockValue = (
        <Link
          href={`/admin/inventory/assets?q=${encodeURIComponent(item.id)}`}
          className="text-sm font-medium text-primary hover:text-primary-hover min-h-[44px] md:min-h-[40px] inline-flex items-center"
        >
          Xem ở Tài sản
        </Link>
      );
    } else {
      stockValue = stock.text;
    }
  }

  const fields: Field[] = [
    { label: "Mã", value: item.id },
    { label: "Tên", value: item.name },
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

      <FieldList fields={fields} />

      {/* Section: Quy đổi (N) */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-text-primary">
            Quy đổi ({conversions.length})
          </h2>
          <Link
            href={`/admin/inventory/conversions?q=${encodeURIComponent(item.name)}`}
            className="text-sm font-medium text-primary hover:text-primary-hover min-h-[44px] md:min-h-[40px] inline-flex items-center"
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
                        {conv.conversion_rate}
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

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border bg-surface-card rounded-card border border-border">
              {conversions.map((conv) => (
                <div key={conv.id} className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="text-text-primary">
                      1 {getUnitName(conv.purchased_unit, units)} = {conv.conversion_rate}{" "}
                      {getUnitName(conv.base_unit, units)}
                    </div>
                    <Badge
                      variant={conv.status === "INACTIVE" ? "neutral" : "processing"}
                    >
                      {conv.status === "INACTIVE" ? "Ngừng dùng" : "Đang dùng"}
                    </Badge>
                  </div>
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
