"use client";

import React from "react";
import Link from "next/link";
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
}: ItemDetailViewProps): JSX.Element {
  const isNonInventory =
    item.is_non_inventory === true || (item.is_non_inventory as any) === "true";

  let stockValue: React.ReactNode = "—";
  if (stock) {
    if (stock.kind === "equipment") {
      stockValue = (
        <Link
          href={`/admin/inventory/assets?q=${encodeURIComponent(item.id)}`}
          className="text-sm font-medium text-primary hover:text-primary-hover min-h-[44px] inline-flex items-center"
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
      <Link
        href={editHref}
        className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm min-h-[44px] flex items-center justify-center text-sm"
      >
        Chỉnh sửa
      </Link>
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
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-secondary text-text-secondary border border-border">
              Ngừng dùng
            </span>
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
            className="text-sm font-medium text-primary hover:text-primary-hover min-h-[44px] inline-flex items-center"
          >
            Xem trong Bảng quy đổi &rarr;
          </Link>
        </div>

        {conversions.length === 0 ? (
          <div className="bg-surface-card rounded-2xl border border-border p-6 text-center text-sm text-text-muted">
            Chưa có quy đổi nào.
          </div>
        ) : (
          <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4 font-bold">Đơn vị mua</th>
                    <th className="px-6 py-4 font-bold">Hệ số</th>
                    <th className="px-6 py-4 font-bold">Đơn vị gốc</th>
                    <th className="px-6 py-4 font-bold">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {conversions.map((conv) => (
                    <tr
                      key={conv.id}
                      className="hover:bg-surface-secondary/50 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium text-text-primary">
                        {getUnitName(conv.purchased_unit, units)}
                      </td>
                      <td className="px-6 py-4 font-mono text-text-muted">
                        {conv.conversion_rate}
                      </td>
                      <td className="px-6 py-4 text-text-secondary">
                        {getUnitName(conv.base_unit, units)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                            conv.status === "INACTIVE"
                              ? "bg-surface-secondary text-text-secondary border-border"
                              : "bg-primary-soft text-primary-active border-primary/20"
                          }`}
                        >
                          {conv.status === "INACTIVE" ? "Ngừng dùng" : "Đang dùng"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {conversions.map((conv) => (
                <div key={conv.id} className="p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-text-primary">
                      1 {getUnitName(conv.purchased_unit, units)} = {conv.conversion_rate}{" "}
                      {getUnitName(conv.base_unit, units)}
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${
                        conv.status === "INACTIVE"
                          ? "bg-surface-secondary text-text-secondary border-border"
                          : "bg-primary-soft text-primary-active border-primary/20"
                      }`}
                    >
                      {conv.status === "INACTIVE" ? "Ngừng dùng" : "Đang dùng"}
                    </span>
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
