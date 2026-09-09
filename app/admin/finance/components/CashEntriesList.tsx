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

// Desktop columns line up with this template; mobile ignores it entirely
// (grid-cols-1) and relies on the per-field `order-*` classes below instead.
const ROW_GRID =
  "grid grid-cols-1 gap-1 md:grid-cols-[100px_140px_60px_120px_110px_140px_1fr_110px_110px_170px] md:items-center md:gap-4";

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

// Renders as a real desktop table column (comparable by eye) and as a
// mobile label-value line, from the SAME element -- not a second copy --
// so the row's one status badge and one set of action buttons never render
// twice (.claude/rules/ui-devices.md: two intentional layouts, not one
// generic stretch, achieved here through per-field order rather than a
// duplicated subtree).
// Tailwind's class scanner needs each order-N literal spelled out in source
// (it cannot see a value built by string interpolation), so `orderClass`
// takes the whole class name, not a bare number.
function Field({
  label,
  orderClass,
  className,
  children,
}: {
  label: string;
  orderClass: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="cell" className={`${orderClass} md:order-none ${className ?? ""}`}>
      <span className="md:hidden text-text-muted">{label}: </span>
      {children}
    </div>
  );
}

// Extracted out of page.tsx so it is directly render-testable -- same
// reason as app/admin/finance/categories/components/CategoriesList.tsx.
export function CashEntriesList({ entries, categories, accounts, canDelete }: CashEntriesListProps) {
  // useRouter() throws outside an App Router context. This component's own
  // render test (app/admin/finance/components/CashEntriesList.test.tsx) does
  // not mount one and does not mock next/navigation, so the fallback keeps
  // the initial render safe there; router.refresh() is only ever reached
  // after a real write, and every real render of this screen has the App
  // Router context the actual admin layout provides.
  let router: ReturnType<typeof useRouter> | null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }
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
    router?.refresh();
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
    router?.refresh();
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
        <div
          role="table"
          className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden divide-y divide-border md:divide-y-0"
        >
          {/* Header: desktop only, column names match the grid template above. */}
          <div
            role="row"
            className={`hidden md:grid ${ROW_GRID} bg-page/50 text-text-muted font-medium text-sm px-4 py-3 border-b border-border`}
          >
            <div role="columnheader">Ngày</div>
            <div role="columnheader">Nhóm</div>
            <div role="columnheader">Bên</div>
            <div role="columnheader" className="text-right">Số tiền</div>
            <div role="columnheader">Cách trả</div>
            <div role="columnheader">Tài khoản</div>
            <div role="columnheader">Ghi chú</div>
            <div role="columnheader">Người tạo</div>
            <div role="columnheader">Trạng thái</div>
            <div role="columnheader" className="text-right">Thao tác</div>
          </div>

          {entries.map((entry) => {
            const category = categoryById.get(entry.category_id);
            const account = entry.bank_account_id ? accountById.get(entry.bank_account_id) : undefined;
            const isCancelled = entry.status === "CANCELLED";

            return (
              <div
                key={entry.id}
                role="row"
                className={`${ROW_GRID} p-4 md:px-4 md:py-3 ${isCancelled ? "opacity-50" : ""}`}
              >
                <Field label="Ngày" orderClass="order-3" className="text-text-secondary text-sm">
                  {formatDate(entry.entry_date)}
                </Field>
                <Field label="Nhóm" orderClass="order-4" className="text-text-primary font-medium text-sm">
                  {category?.name ?? "—"}
                </Field>
                <Field label="Bên" orderClass="order-5" className="text-text-secondary text-sm">
                  {category ? KIND_LABEL[category.kind] : "—"}
                </Field>
                <Field
                  label="Số tiền"
                  orderClass="order-1"
                  className="font-bold text-lg text-text-primary md:font-semibold md:text-sm md:text-right"
                >
                  {money(entry.amount)}
                </Field>
                <Field label="Cách trả" orderClass="order-6" className="text-text-secondary text-sm">
                  {PAYMENT_METHOD_LABEL[entry.payment_method]}
                </Field>
                <Field label="Tài khoản" orderClass="order-7" className="text-text-secondary text-sm">
                  {account?.name ?? "—"}
                </Field>
                <Field label="Ghi chú" orderClass="order-8" className="text-text-secondary text-sm">
                  {display(entry.note)}
                </Field>
                <Field label="Người tạo" orderClass="order-9" className="text-text-secondary text-sm">
                  {display(entry.created_by_name)}
                </Field>
                <div role="cell" className="order-2 md:order-none">
                  <StatusBadge status={entry.status} />
                </div>
                <div
                  role="cell"
                  className="order-last md:order-none flex items-center gap-4 pt-3 mt-1 border-t border-border md:pt-0 md:mt-0 md:border-t-0 md:justify-end"
                >
                  {!isCancelled && (
                    <div className="flex items-center min-h-[44px] md:min-h-0">
                      <CashEntryForm entry={entry} categories={categories} accounts={accounts} />
                    </div>
                  )}
                  {!isCancelled && (
                    <div className="flex items-center min-h-[44px] md:min-h-0">
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
                    <div className="flex items-center min-h-[44px] md:min-h-0">
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
