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
import { confirm } from "@/lib/shared/dialog";
import { setBankAccountStatus, deleteBankAccount } from "@/app/admin/finance/bank-accounts/actions";
import type { DBBankAccount } from "@/types/db";

export interface BankAccountDetailViewProps {
  account: DBBankAccount;
  returnTo: string;
  canDelete: boolean;
}

function display(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "—";
}

export function BankAccountDetailView({
  account,
  returnTo,
  canDelete,
}: BankAccountDetailViewProps) {
  const router = useRouter();
  const [statusLoading, setStatusLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentDetailUrl = `/admin/finance/bank-accounts/${encodeURIComponent(account.id)}?returnTo=${encodeURIComponent(returnTo)}`;
  const editHref = `/admin/finance/bank-accounts/${encodeURIComponent(account.id)}/edit?returnTo=${encodeURIComponent(currentDetailUrl)}`;

  const handleToggleStatus = async () => {
    setActionError(null);
    const nextStatus = account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const approved = await confirm({
      title: nextStatus === "INACTIVE" ? "Ngừng dùng tài khoản" : "Dùng lại tài khoản",
      message:
        nextStatus === "INACTIVE"
          ? `Ngừng dùng tài khoản "${account.name}"? Tài khoản sẽ không còn hiện khi ghi khoản thu chi mới, nhưng các dòng đã ghi vẫn giữ nguyên.`
          : `Dùng lại tài khoản "${account.name}"?`,
      okText: nextStatus === "INACTIVE" ? "Ngừng dùng" : "Dùng lại",
      cancelText: "Huỷ",
      variant: nextStatus === "INACTIVE" ? "warning" : "info",
    });
    if (!approved) return;

    setStatusLoading(true);
    try {
      const fd = new FormData();
      fd.set("id", account.id);
      fd.set("status", nextStatus);
      const res = await setBankAccountStatus(fd);
      if (res?.error) {
        setActionError(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setStatusLoading(false);
    }
  };

  const statusBadge =
    account.status === "ACTIVE" ? (
      <Badge variant="success">Đang dùng</Badge>
    ) : (
      <Badge variant="warning">Ngừng dùng</Badge>
    );

  const fields: Field[] = [
    { label: "Mã", value: account.id },
    { label: "Tên", value: account.name },
    { label: "Ngân hàng", value: display(account.bank_name) },
    { label: "Số tài khoản", value: display(account.account_number) },
    { label: "Trạng thái", value: statusBadge },
  ];

  const headerActions = (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button href={editHref} variant="secondary">
          Chỉnh sửa
        </Button>
        {account.status === "ACTIVE" ? (
          <Button
            type="button"
            variant="delete"
            onClick={handleToggleStatus}
            loading={statusLoading}
          >
            Ngừng dùng
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={handleToggleStatus}
            loading={statusLoading}
          >
            Dùng lại
          </Button>
        )}
        {canDelete && (
          <RemoveRecordButton
            verb="Xoá"
            name={account.name}
            confirmMessage={`Xoá tài khoản "${account.name}"? Không thể hoàn tác. Nếu đã có dòng sổ dùng tài khoản này, hệ thống sẽ từ chối xoá.`}
            remove={async () => {
              const fd = new FormData();
              fd.set("id", account.id);
              return await deleteBankAccount(fd);
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
        backLabel="Tài khoản ngân hàng"
        title={account.name}
        subtitle={account.id}
        badge={account.status !== "ACTIVE" ? <Badge variant="warning">Ngừng dùng</Badge> : undefined}
        actions={headerActions}
      />

      <FieldList fields={fields} />
    </DetailFrame>
  );
}
