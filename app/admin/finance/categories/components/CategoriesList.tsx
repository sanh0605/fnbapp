"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CategoryForm } from "./CategoryForm";
import { setCashCategoryStatus, deleteCashCategory } from "../actions";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { confirm, alert } from "@/lib/shared/dialog";
import type { DBCashCategory } from "@/types/db";

interface CategoriesListProps {
  categories: DBCashCategory[];
  // ADMIN only (BR-ACCESS-003) -- everyone else may add, edit and retire.
  canDelete: boolean;
  // I3 -- ids of every category any Cash_Entries row references (any
  // status), computed server-side in page.tsx.
  usedCategoryIds: string[];
}

const KIND_LABEL: Record<DBCashCategory["kind"], string> = {
  EXPENSE: "Chi",
  INCOME: "Thu",
};

const STATUS_LABEL: Record<DBCashCategory["status"], string> = {
  ACTIVE: "Đang dùng",
  INACTIVE: "Ngừng dùng",
};

function StatusBadge({ status }: { status: DBCashCategory["status"] }) {
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
// reason as app/admin/outlets/components/OutletsList.tsx.
export function CategoriesList({ categories, canDelete, usedCategoryIds }: CategoriesListProps) {
  const router = useRouter();
  const usedIds = new Set(usedCategoryIds);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DBCashCategory | null>(null);

  async function handleToggleStatus(category: DBCashCategory) {
    const nextStatus = category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const approved = await confirm({
      title: nextStatus === "INACTIVE" ? "Ngừng dùng nhóm" : "Dùng lại nhóm",
      message:
        nextStatus === "INACTIVE"
          ? `Ngừng dùng nhóm "${category.name}"? Nhóm sẽ không còn hiện khi ghi khoản thu chi mới, nhưng các dòng đã ghi vẫn giữ nguyên.`
          : `Dùng lại nhóm "${category.name}"?`,
      okText: nextStatus === "INACTIVE" ? "Ngừng dùng" : "Dùng lại",
      cancelText: "Huỷ",
      variant: nextStatus === "INACTIVE" ? "warning" : "info",
    });
    if (!approved) return;

    setBusyId(category.id);
    const formData = new FormData();
    formData.set("id", category.id);
    formData.set("status", nextStatus);
    const result = await setCashCategoryStatus(formData);
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
    const result = await deleteCashCategory(formData);
    if (result.error) {
      await alert({ title: "Không thể xoá nhóm", message: result.error, variant: "danger" });
      return;
    }
    router.refresh();
  }

  if (categories.length === 0) {
    return (
      <div className="bg-surface-card rounded-2xl shadow-sm border border-border">
        <EmptyState
          icon="💰"
          title="Chưa có nhóm thu chi"
          description="Thêm nhóm đầu tiên để bắt đầu ghi sổ."
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
              <th className="px-4 py-3">Bên</th>
              <th className="px-4 py-3">Tính vào lãi lỗ</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((category) => (
              <tr key={category.id} className="hover:bg-page/40">
                <td className="px-4 py-3 font-medium text-text-primary">{category.name}</td>
                <td className="px-4 py-3 text-text-secondary">{KIND_LABEL[category.kind]}</td>
                <td className="px-4 py-3 text-text-secondary">{category.affects_pnl ? "Có" : "Không"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={category.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end items-center gap-4">
                    <CategoryForm category={category} hasEntries={usedIds.has(category.id)} />
                    <button
                      onClick={() => handleToggleStatus(category)}
                      disabled={busyId === category.id}
                      className="text-text-secondary hover:text-text-primary font-medium text-sm disabled:opacity-50"
                    >
                      {busyId === category.id ? "…" : category.status === "ACTIVE" ? "Ngừng dùng" : "Dùng lại"}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setDeleteTarget(category)}
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

      {/* Phone: one vertical card per group, no horizontal table (.claude/rules/ui-devices.md) */}
      <div className="md:hidden flex flex-col gap-3 p-4">
        {categories.map((category) => (
          <div key={category.id} className="bg-surface-card rounded-xl border border-border p-4 shadow-sm flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div className="font-bold text-text-primary">{category.name}</div>
              <StatusBadge status={category.status} />
            </div>

            <div className="text-sm text-text-secondary space-y-1">
              <div>
                <span className="text-text-muted">Bên:</span>{" "}
                <span className="font-medium">{KIND_LABEL[category.kind]}</span>
              </div>
              <div>
                <span className="text-text-muted">Tính vào lãi lỗ:</span>{" "}
                <span className="font-medium">{category.affects_pnl ? "Có" : "Không"}</span>
              </div>
            </div>

            <div className="flex justify-end items-center gap-4 pt-3 mt-1 border-t border-border">
              <div className="flex items-center min-h-[44px]">
                <CategoryForm category={category} hasEntries={usedIds.has(category.id)} />
              </div>
              <div className="flex items-center min-h-[44px]">
                <button
                  onClick={() => handleToggleStatus(category)}
                  disabled={busyId === category.id}
                  className="text-text-secondary hover:text-text-primary font-medium text-sm disabled:opacity-50"
                >
                  {busyId === category.id ? "…" : category.status === "ACTIVE" ? "Ngừng dùng" : "Dùng lại"}
                </button>
              </div>
              {canDelete && (
                <div className="flex items-center min-h-[44px]">
                  <button
                    onClick={() => setDeleteTarget(category)}
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
        title="Xoá hẳn nhóm thu chi"
        description={
          deleteTarget
            ? `Xoá hẳn nhóm "${deleteTarget.name}"? Không thể hoàn tác. Nếu đã có dòng sổ dùng nhóm này, hệ thống sẽ từ chối xoá.`
            : undefined
        }
      />
    </div>
  );
}
