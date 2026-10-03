"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDateTime } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { confirm } from "@/lib/shared/dialog";
import { cancelCashEntry, deleteCashEntry } from "@/app/admin/finance/actions";
import type { DBBankAccount, DBCashCategory, DBCashEntry } from "@/types/db";

export interface CashEntryDetailViewProps {
  entry: DBCashEntry;
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
  returnTo: string;
  canDelete: boolean;
}

const PAYMENT_METHOD_LABEL: Record<DBCashEntry["payment_method"], string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};

const KIND_LABEL: Record<DBCashCategory["kind"], string> = {
  EXPENSE: "Chi",
  INCOME: "Thu",
};

export function CashEntryDetailView({
  entry,
  categories,
  accounts,
  returnTo,
  canDelete,
}: CashEntryDetailViewProps): JSX.Element {
  const router = useRouter();
  const [cancelLoading, setCancelLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const category = categories.find((c) => c.id === entry.category_id);
  const account = entry.bank_account_id
    ? accounts.find((a) => a.id === entry.bank_account_id)
    : undefined;

  const isCancelled = entry.status === "CANCELLED";
  const amountStr = `${formatNumber(entry.amount)}đ`;
  const titleText = category ? `${category.name} · ${amountStr}` : `${entry.id} · ${amountStr}`;

  const currentDetailUrl = `/admin/finance/${encodeURIComponent(entry.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/finance/${encodeURIComponent(entry.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const handleCancel = async () => {
    setActionError(null);
    const approved = await confirm({
      title: "Huỷ dòng sổ",
      message: `Huỷ dòng ngày ${formatDate(entry.entry_date)}, số tiền ${amountStr}? Dòng vẫn hiện trong danh sách nhưng không tính vào tổng nữa.`,
      okText: "Huỷ dòng",
      cancelText: "Đóng",
      variant: "warning",
    });
    if (!approved) return;

    setCancelLoading(true);
    try {
      const fd = new FormData();
      fd.set("id", entry.id);
      const res = await cancelCashEntry(fd);
      if (res?.error) {
        setActionError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setCancelLoading(false);
    }
  };

  const statusBadge =
    entry.status === "ACTIVE" ? (
      <Badge variant="success">Đang dùng</Badge>
    ) : (
      <Badge variant="neutral">Đã huỷ</Badge>
    );

  const fields: Field[] = [
    { label: "Mã", value: entry.id },
    { label: "Ngày", value: formatDate(entry.entry_date) },
    { label: "Nhóm", value: category?.name ?? "—" },
    { label: "Bên", value: category ? KIND_LABEL[category.kind] : "—" },
    { label: "Số tiền", value: amountStr },
    { label: "Cách trả", value: PAYMENT_METHOD_LABEL[entry.payment_method] },
    { label: "Tài khoản", value: account?.name ?? "—" },
    { label: "Ghi chú", value: entry.note && entry.note.length > 0 ? entry.note : "—" },
    { label: "Người tạo", value: entry.created_by_name && entry.created_by_name.length > 0 ? entry.created_by_name : "—" },
    {
      label: "Ghi sổ lúc",
      value: entry.created_at ? formatDateTime(entry.created_at) : "—",
    },
    { label: "Trạng thái", value: statusBadge },
  ];

  const headerActions = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!isCancelled && (
          <Link
            href={editHref}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm min-h-[44px] flex items-center justify-center text-sm"
          >
            Chỉnh sửa
          </Link>
        )}
        {!isCancelled && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelLoading}
            className="px-4 py-2 text-sm font-medium text-text-secondary border border-border rounded-lg hover:bg-surface-secondary transition min-h-[44px] flex items-center justify-center disabled:opacity-50"
          >
            {cancelLoading ? "Đang xử lý..." : "Huỷ"}
          </button>
        )}
        {canDelete && (
          <RemoveRecordButton
            verb="Xoá hẳn"
            name={entry.id}
            confirmMessage={`Xoá hẳn dòng ngày ${formatDate(entry.entry_date)}, số tiền ${amountStr}? Không thể hoàn tác.`}
            remove={async () => {
              const fd = new FormData();
              fd.set("id", entry.id);
              return await deleteCashEntry(fd);
            }}
            afterHref={returnTo}
          />
        )}
      </div>
      {actionError && (
        <div
          role="alert"
          className="text-sm font-medium text-danger bg-danger/10 border border-danger/20 rounded-lg p-3"
        >
          {actionError}
        </div>
      )}
    </div>
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Sổ thu chi"
        title={titleText}
        subtitle={entry.id}
        badge={isCancelled ? <Badge variant="neutral">Đã huỷ</Badge> : undefined}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
