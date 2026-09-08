"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BankAccountForm } from "./BankAccountForm";
import { setBankAccountStatus, deleteBankAccount } from "../actions";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { confirm, alert } from "@/lib/shared/dialog";
import type { DBBankAccount } from "@/types/db";

interface BankAccountsListProps {
  accounts: DBBankAccount[];
  // ADMIN only (BR-ACCESS-003) -- everyone else may add, edit and retire.
  canDelete: boolean;
}

const STATUS_LABEL: Record<DBBankAccount["status"], string> = {
  ACTIVE: "Đang dùng",
  INACTIVE: "Ngừng dùng",
};

// Blank bank_name / account_number renders as "—", never the literal "null".
function display(value: string | null): string {
  return value && value.length > 0 ? value : "—";
}

function StatusBadge({ status }: { status: DBBankAccount["status"] }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
        status === "ACTIVE"
          ? "bg-success/10 text-success border-success/20"
          : "bg-surface-secondary text-text-secondary border-border"
      }`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// Extracted out of page.tsx so it is directly render-testable -- same
// reason as app/admin/finance/categories/components/CategoriesList.tsx.
export function BankAccountsList({ accounts, canDelete }: BankAccountsListProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBBankAccount | null>(null);

  async function handleToggleStatus(account: DBBankAccount) {
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

    setBusyId(account.id);
    const formData = new FormData();
    formData.set("id", account.id);
    formData.set("status", nextStatus);
    const result = await setBankAccountStatus(formData);
    setBusyId(null);

    if (result.error) {
      await alert({ title: "Không thể đổi trạng thái", message: result.error, variant: "danger" });
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const formData = new FormData();
    formData.set("id", deleteTarget.id);
    const result = await deleteBankAccount(formData);
    if (result.error) {
      await alert({ title: "Không thể xoá tài khoản", message: result.error, variant: "danger" });
      return;
    }
    router.refresh();
  }

  if (accounts.length === 0) {
    return (
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border">
        <EmptyState
          icon="🏦"
          title="Chưa có tài khoản ngân hàng"
          description="Thêm tài khoản đầu tiên để ghi khoản chuyển khoản."
        />
      </div>
    );
  }

  return (
    <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
      {/* Desktop: a real table, columns compared by eye (.claude/rules/ui-devices.md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-page/50 text-text-muted font-medium border-b border-border">
            <tr>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3">Ngân hàng</th>
              <th className="px-4 py-3">Số tài khoản</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {accounts.map((account) => (
              <tr key={account.id} className="hover:bg-page/40">
                <td className="px-4 py-3 font-medium text-text-primary">{account.name}</td>
                <td className="px-4 py-3 text-text-secondary">{display(account.bank_name)}</td>
                <td className="px-4 py-3 text-text-secondary">{display(account.account_number)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={account.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end items-center gap-4">
                    <BankAccountForm account={account} />
                    <button
                      onClick={() => handleToggleStatus(account)}
                      disabled={busyId === account.id}
                      className="text-text-secondary hover:text-text-primary font-medium text-sm disabled:opacity-50"
                    >
                      {busyId === account.id ? "…" : account.status === "ACTIVE" ? "Ngừng dùng" : "Dùng lại"}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteTarget(account)}
                        className="text-danger hover:text-danger-active font-medium text-sm"
                      >
                        Xoá hẳn
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phone: one vertical card per account, no horizontal table (.claude/rules/ui-devices.md) */}
      <div className="md:hidden flex flex-col gap-3 p-4">
        {accounts.map((account) => (
          <div key={account.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="font-bold text-text-primary">{account.name}</div>
              <StatusBadge status={account.status} />
            </div>

            <div className="text-sm text-text-secondary space-y-1">
              <div>
                <span className="text-text-muted">Ngân hàng:</span>{" "}
                <span className="font-medium">{display(account.bank_name)}</span>
              </div>
              <div>
                <span className="text-text-muted">Số tài khoản:</span>{" "}
                <span className="font-medium">{display(account.account_number)}</span>
              </div>
            </div>

            <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-border">
              <div className="flex items-center min-h-[44px]">
                <BankAccountForm account={account} />
              </div>
              <div className="flex items-center min-h-[44px]">
                <button
                  onClick={() => handleToggleStatus(account)}
                  disabled={busyId === account.id}
                  className="text-text-secondary hover:text-text-primary font-medium text-sm disabled:opacity-50"
                >
                  {busyId === account.id ? "…" : account.status === "ACTIVE" ? "Ngừng dùng" : "Dùng lại"}
                </button>
              </div>
              {canDelete && (
                <div className="flex items-center min-h-[44px]">
                  <button
                    onClick={() => setDeleteTarget(account)}
                    className="text-danger hover:text-danger-active font-medium text-sm"
                  >
                    Xoá hẳn
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xoá hẳn tài khoản ngân hàng"
        description={
          deleteTarget
            ? `Xoá hẳn tài khoản "${deleteTarget.name}"? Không thể hoàn tác. Nếu đã có dòng sổ dùng tài khoản này, hệ thống sẽ từ chối xoá.`
            : undefined
        }
      />
    </div>
  );
}
