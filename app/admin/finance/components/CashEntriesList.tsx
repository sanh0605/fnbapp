"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CashEntryForm } from "./CashEntryForm";
import { cancelCashEntry, deleteCashEntry } from "../actions";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { confirm, alert } from "@/lib/shared/dialog";
import { formatNumber } from "@/lib/shared/format";
import { formatDate } from "@/lib/shared/datetime";
import { summariseEntries } from "@/lib/finance/cash-entry-rules";
import type { DBBankAccount, DBCashCategory, DBCashEntry } from "@/types/db";

interface CashEntriesListProps {
  entries: DBCashEntry[];
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
  // ADMIN only (BR-ACCESS-003) -- everyone else may add, edit and cancel.
  canDelete: boolean;
}

const STATUS_LABEL: Record<DBCashEntry["status"], string> = {
  ACTIVE: "Đang dùng",
  CANCELLED: "Đã huỷ",
};

const PAYMENT_METHOD_LABEL: Record<DBCashEntry["payment_method"], string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};

const KIND_LABEL: Record<DBCashCategory["kind"], string> = {
  EXPENSE: "Chi",
  INCOME: "Thu",
};

function display(value: string | null): string {
  return value && value.length > 0 ? value : "—";
}

function money(value: number): string {
  return `${formatNumber(value)}đ`;
}

function StatusBadge({ status }: { status: DBCashEntry["status"] }) {
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
export function CashEntriesList({ entries, categories, accounts, canDelete }: CashEntriesListProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBCashEntry | null>(null);

  const summary = summariseEntries(entries, categories);
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  async function handleCancel(entry: DBCashEntry) {
    const approved = await confirm({
      title: "Huỷ dòng sổ",
      message: `Huỷ dòng ngày ${formatDate(entry.entry_date)}, số tiền ${money(entry.amount)}? Dòng vẫn hiện trong danh sách nhưng không tính vào tổng nữa.`,
      okText: "Huỷ dòng",
      cancelText: "Đóng",
      variant: "warning",
    });
    if (!approved) return;

    setBusyId(entry.id);
    const formData = new FormData();
    formData.set("id", entry.id);
    const result = await cancelCashEntry(formData);
    setBusyId(null);

    if (result.error) {
      await alert({ title: "Không thể huỷ", message: result.error, variant: "danger" });
      return;
    }
    router.refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const formData = new FormData();
    formData.set("id", deleteTarget.id);
    const result = await deleteCashEntry(formData);
    if (result.error) {
      await alert({ title: "Không thể xoá hẳn", message: result.error, variant: "danger" });
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="text-sm text-text-muted">Tổng chi</div>
          <div data-testid="total-expense" className="text-xl font-bold text-danger mt-1">
            {money(summary.totalExpense)}
          </div>
        </div>
        <div className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="text-sm text-text-muted">Tổng thu</div>
          <div data-testid="total-income" className="text-xl font-bold text-success mt-1">
            {money(summary.totalIncome)}
          </div>
        </div>
        <div className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm">
          <div className="text-sm text-text-muted">Thu ngoài lãi lỗ (vốn góp, ...)</div>
          <div data-testid="income-outside-pnl" className="text-xl font-bold text-text-primary mt-1">
            {money(summary.incomeOutsidePnl)}
          </div>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="bg-surface-card rounded-2xl shadow-sm border border-border">
          <EmptyState
            icon="🧾"
            title="Chưa có khoản nào trong khoảng này"
            description="Thêm khoản thu chi đầu tiên trong khoảng thời gian đang chọn."
          />
        </div>
      ) : (
        <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden">
          {/* Desktop: a real table, columns compared by eye (.claude/rules/ui-devices.md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-page/50 text-text-muted font-medium border-b border-border">
                <tr>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3">Nhóm</th>
                  <th className="px-4 py-3">Bên</th>
                  <th className="px-4 py-3 text-right">Số tiền</th>
                  <th className="px-4 py-3">Cách trả</th>
                  <th className="px-4 py-3">Tài khoản</th>
                  <th className="px-4 py-3">Ghi chú</th>
                  <th className="px-4 py-3">Người tạo</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => {
                  const category = categoryById.get(entry.category_id);
                  const account = entry.bank_account_id ? accountById.get(entry.bank_account_id) : undefined;
                  const isCancelled = entry.status === "CANCELLED";
                  return (
                    <tr key={entry.id} className={`hover:bg-page/40 ${isCancelled ? "opacity-50" : ""}`}>
                      <td className="px-4 py-3 text-text-secondary">{formatDate(entry.entry_date)}</td>
                      <td className="px-4 py-3 text-text-primary font-medium">{category?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">{category ? KIND_LABEL[category.kind] : "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-text-primary">{money(entry.amount)}</td>
                      <td className="px-4 py-3 text-text-secondary">{PAYMENT_METHOD_LABEL[entry.payment_method]}</td>
                      <td className="px-4 py-3 text-text-secondary">{account?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-text-secondary">{display(entry.note)}</td>
                      <td className="px-4 py-3 text-text-secondary">{display(entry.created_by_name)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={entry.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end items-center gap-4">
                          {!isCancelled && (
                            <CashEntryForm entry={entry} categories={categories} accounts={accounts} />
                          )}
                          {!isCancelled && (
                            <button
                              onClick={() => handleCancel(entry)}
                              disabled={busyId === entry.id}
                              className="text-text-secondary hover:text-text-primary font-medium text-sm disabled:opacity-50"
                            >
                              {busyId === entry.id ? "…" : "Huỷ"}
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(entry)}
                              className="text-danger hover:text-danger-active font-medium text-sm"
                            >
                              Xoá hẳn
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Phone: one vertical card per line, no horizontal table (.claude/rules/ui-devices.md) */}
          <div className="md:hidden flex flex-col gap-3 p-4">
            {entries.map((entry) => {
              const category = categoryById.get(entry.category_id);
              const account = entry.bank_account_id ? accountById.get(entry.bank_account_id) : undefined;
              const isCancelled = entry.status === "CANCELLED";
              return (
                <div
                  key={entry.id}
                  className={`bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3 ${isCancelled ? "opacity-50" : ""}`}
                >
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-lg text-text-primary">{money(entry.amount)}</div>
                    <StatusBadge status={entry.status} />
                  </div>

                  <div className="text-sm text-text-secondary space-y-1">
                    <div>
                      <span className="text-text-muted">Ngày:</span>{" "}
                      <span className="font-medium">{formatDate(entry.entry_date)}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">Nhóm:</span>{" "}
                      <span className="font-medium">{category?.name ?? "—"}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">Bên:</span>{" "}
                      <span className="font-medium">{category ? KIND_LABEL[category.kind] : "—"}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">Cách trả:</span>{" "}
                      <span className="font-medium">{PAYMENT_METHOD_LABEL[entry.payment_method]}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">Tài khoản:</span>{" "}
                      <span className="font-medium">{account?.name ?? "—"}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">Ghi chú:</span>{" "}
                      <span className="font-medium">{display(entry.note)}</span>
                    </div>
                    <div>
                      <span className="text-text-muted">Người tạo:</span>{" "}
                      <span className="font-medium">{display(entry.created_by_name)}</span>
                    </div>
                  </div>

                  <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-border">
                    {!isCancelled && (
                      <div className="flex items-center min-h-[44px]">
                        <CashEntryForm entry={entry} categories={categories} accounts={accounts} />
                      </div>
                    )}
                    {!isCancelled && (
                      <div className="flex items-center min-h-[44px]">
                        <button
                          onClick={() => handleCancel(entry)}
                          disabled={busyId === entry.id}
                          className="text-text-secondary hover:text-text-primary font-medium text-sm disabled:opacity-50"
                        >
                          {busyId === entry.id ? "…" : "Huỷ"}
                        </button>
                      </div>
                    )}
                    {canDelete && (
                      <div className="flex items-center min-h-[44px]">
                        <button
                          onClick={() => setDeleteTarget(entry)}
                          className="text-danger hover:text-danger-active font-medium text-sm"
                        >
                          Xoá hẳn
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xoá hẳn dòng sổ"
        description={
          deleteTarget
            ? `Xoá hẳn dòng ngày ${formatDate(deleteTarget.entry_date)}, số tiền ${money(deleteTarget.amount)}? Không thể hoàn tác.`
            : undefined
        }
      />
    </div>
  );
}
