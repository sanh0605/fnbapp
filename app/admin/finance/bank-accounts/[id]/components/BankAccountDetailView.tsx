"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
}: BankAccountDetailViewProps): JSX.Element {
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
        <Link
          href={editHref}
          className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm min-h-[44px] flex items-center justify-center text-sm"
        >
          Chỉnh sửa
        </Link>
        {account.status === "ACTIVE" ? (
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={statusLoading}
            className="px-4 py-2 text-sm font-medium text-warning border border-warning/30 rounded-lg hover:bg-warning/10 transition min-h-[44px] flex items-center justify-center disabled:opacity-50"
          >
            {statusLoading ? "Đang xử lý..." : "Ngừng dùng"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={statusLoading}
            className="px-4 py-2 text-sm font-medium text-success border border-success/30 rounded-lg hover:bg-success/10 transition min-h-[44px] flex items-center justify-center disabled:opacity-50"
          >
            {statusLoading ? "Đang xử lý..." : "Dùng lại"}
          </button>
        )}
        {canDelete && (
          <RemoveRecordButton
            verb="Xoá hẳn"
            name={account.name}
            confirmMessage={`Xoá hẳn tài khoản "${account.name}"? Không thể hoàn tác. Nếu đã có dòng sổ dùng tài khoản này, hệ thống sẽ từ chối xoá.`}
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
