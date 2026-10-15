"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DetailFrame } from "@/components/ui/detail/DetailFrame";
import { DetailHeader } from "@/components/ui/detail/DetailHeader";
import { FieldList, type Field } from "@/components/ui/detail/FieldList";
import { RemoveRecordButton } from "@/components/ui/detail/RemoveRecordButton";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDateTime } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { confirm } from "@/lib/shared/dialog";
import { cancelCashTransfer, deleteCashTransfer } from "@/app/admin/finance/transfers/actions";
import type { DBBankAccount, DBCashTransfer } from "@/types/db";

export interface CashTransferDetailViewProps {
  transfer: DBCashTransfer;
  accounts: DBBankAccount[];
  returnTo: string;
  canDelete: boolean;
}

const CASH_LABEL = "Tiền mặt (két)";

export function CashTransferDetailView({
  transfer,
  accounts,
  returnTo,
  canDelete,
}: CashTransferDetailViewProps) {
  const router = useRouter();
  const [cancelLoading, setCancelLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));
  const fromText =
    transfer.from_account_id === null
      ? CASH_LABEL
      : (accountNames.get(transfer.from_account_id) ?? transfer.from_account_id);
  const toText =
    transfer.to_account_id === null
      ? CASH_LABEL
      : (accountNames.get(transfer.to_account_id) ?? transfer.to_account_id);

  const isCancelled = transfer.status === "CANCELLED";
  const amountStr = `${formatNumber(transfer.amount)}đ`;
  const titleText = `${fromText} → ${toText} · ${amountStr}`;

  const currentDetailUrl = `/admin/finance/transfers/${encodeURIComponent(transfer.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/finance/transfers/${encodeURIComponent(transfer.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const handleCancel = async () => {
    setActionError(null);
    const approved = await confirm({
      title: "Huỷ dòng chuyển tiền",
      message: "Huỷ dòng chuyển tiền này? Số dư sẽ tính lại.",
      okText: "Huỷ dòng",
      cancelText: "Đóng",
      variant: "warning",
    });
    if (!approved) return;

    setCancelLoading(true);
    try {
      const fd = new FormData();
      fd.set("id", transfer.id);
      const res = await cancelCashTransfer(fd);
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
    transfer.status === "ACTIVE" ? (
      <Badge variant="success">Đang dùng</Badge>
    ) : (
      <Badge variant="neutral">Đã huỷ</Badge>
    );

  const fields: Field[] = [
    { label: "Mã", value: transfer.id },
    { label: "Ngày", value: formatDate(transfer.transfer_date) },
    { label: "Số tiền", value: amountStr },
    { label: "Từ", value: fromText },
    { label: "Đến", value: toText },
    {
      label: "Ghi chú",
      value: transfer.note && transfer.note.length > 0 ? transfer.note : "—",
    },
    { label: "Trạng thái", value: statusBadge },
    {
      label: "Người tạo",
      value:
        transfer.created_by_name && transfer.created_by_name.length > 0
          ? transfer.created_by_name
          : "—",
    },
    {
      label: "Ghi sổ lúc",
      value: transfer.created_at ? formatDateTime(transfer.created_at) : "—",
    },
  ];

  const headerActions = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {!isCancelled && (
          <Button href={editHref} variant="secondary">
            Chỉnh sửa
          </Button>
        )}
        {!isCancelled && (
          <Button
            type="button"
            variant="delete"
            onClick={handleCancel}
            loading={cancelLoading}
          >
            Huỷ
          </Button>
        )}
        {canDelete && (
          <RemoveRecordButton
            verb="Xoá hẳn"
            name={transfer.id}
            confirmMessage={`Xoá hẳn dòng chuyển tiền ${transfer.id}? Không thể hoàn tác.`}
            remove={async () => {
              const fd = new FormData();
              fd.set("id", transfer.id);
              return await deleteCashTransfer(fd);
            }}
            afterHref={returnTo}
          />
        )}
      </div>
      {actionError && (
        <Alert variant="danger">
          {actionError}
        </Alert>
      )}
    </div>
  );

  return (
    <DetailFrame>
      <DetailHeader
        backHref={returnTo}
        backLabel="Sổ thu chi"
        title={titleText}
        subtitle={transfer.id}
        badge={isCancelled ? <Badge variant="neutral">Đã huỷ</Badge> : undefined}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
