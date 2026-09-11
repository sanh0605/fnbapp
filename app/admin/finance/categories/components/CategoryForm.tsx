"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addCashCategory, updateCashCategory } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { confirm } from "@/lib/shared/dialog";
import type { DBCashCategory } from "@/types/db";

interface CategoryFormProps {
  // Present -> edit this category. Absent -> add a new one. Same fields,
  // same modal, same shape as app/admin/outlets/components/OutletForm.tsx.
  category?: DBCashCategory;
  // I3 -- computed server-side (categories/page.tsx): true when any
  // Cash_Entries row (any status) already references this category. Locks
  // the Thu/Chi select; affects_pnl stays editable behind a confirm step.
  hasEntries?: boolean;
}

const AFFECTS_PNL_CHANGE_WARNING =
  "Mọi dòng cũ của nhóm này sẽ được tính lại theo cách mới, kể cả các tháng trước.";

// Exported (not just used) so the gating rule is directly unit-testable:
// jsdom + React 18 (this repo's test toolchain) does not execute a
// function-valued <form action>, which is a React 19 / Next.js
// canary-channel feature -- so a simulated click-to-submit never reaches
// handleSubmit in a test. Same reasoning as resolveDateRange in
// app/admin/finance/resolve-date-range.ts.
export function shouldConfirmAffectsPnlChange(
  isKindLocked: boolean,
  previousAffectsPnl: boolean,
  nextAffectsPnl: boolean,
): boolean {
  return isKindLocked && previousAffectsPnl !== nextAffectsPnl;
}

export function CategoryForm({ category, hasEntries }: CategoryFormProps) {
  const isEdit = !!category;
  const isKindLocked = isEdit && !!hasEntries;
  const formId = useId();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affectsPnl, setAffectsPnl] = useState(category ? category.affects_pnl : true);
  const [kind, setKind] = useState<"EXPENSE" | "INCOME">(category?.kind ?? "EXPENSE");
  const [isSalesRevenue, setIsSalesRevenue] = useState(category?.is_sales_revenue === true);
  // BR-CASH-006: only an income category that counts in profit and loss can
  // be sales revenue. Hidden otherwise, and cleared the moment either
  // condition goes away, so a hidden box can never submit "on".
  const canBeSalesRevenue = kind === "INCOME" && affectsPnl;

  function handleClose() {
    setIsOpen(false);
    setError(null);
  }

  async function handleSubmit(formData: FormData) {
    setError(null);

    if (category) {
      const pnlTreatmentChanged =
        shouldConfirmAffectsPnlChange(isKindLocked, category.affects_pnl, affectsPnl) ||
        shouldConfirmAffectsPnlChange(isKindLocked, category.is_sales_revenue === true, isSalesRevenue);
      if (pnlTreatmentChanged) {
        const approved = await confirm({
          title: "Đổi cách tính lãi lỗ",
          message: AFFECTS_PNL_CHANGE_WARNING,
          okText: "Đổi",
          cancelText: "Huỷ",
        });
        if (!approved) return;
      }
    }

    setLoading(true);
    if (isEdit && category) formData.set("id", category.id);
    const result = isEdit ? await updateCashCategory(formData) : await addCashCategory(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setIsOpen(false);
    router.refresh();
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-primary hover:text-primary-hover font-medium text-sm"
        >
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition"
        >
          + Thêm nhóm
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        title={isEdit ? "Sửa nhóm thu chi" : "Thêm nhóm thu chi"}
        footer={
          <>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium"
            >
              Huỷ
            </button>
            <LoadingButton type="submit" form={formId} loading={loading} loadingText="Đang lưu…">
              {isEdit ? "Cập nhật" : "Lưu nhóm"}
            </LoadingButton>
          </>
        }
      >
        <form id={formId} action={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
              {error}
            </div>
          )}

          <div>
            <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">
              Tên nhóm
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              name="name"
              required
              defaultValue={category?.name}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="VD: Vận hành"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-kind`} className="block text-sm font-medium text-text-secondary mb-1">
              Bên
            </label>
            <select
              id={`${formId}-kind`}
              name={isKindLocked ? undefined : "kind"}
              disabled={isKindLocked}
              value={kind}
              onChange={(e) => {
                const next = e.target.value as "EXPENSE" | "INCOME";
                setKind(next);
                if (next !== "INCOME") setIsSalesRevenue(false);
              }}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary disabled:opacity-60"
            >
              <option value="EXPENSE">Chi</option>
              <option value="INCOME">Thu</option>
            </select>
            {isKindLocked && (
              <>
                <input type="hidden" name="kind" value={category!.kind} />
                <p className="mt-1 text-xs text-text-muted">Đã có dòng sổ — không đổi được bên</p>
              </>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              name="affects_pnl"
              checked={affectsPnl}
              onChange={(e) => {
                setAffectsPnl(e.target.checked);
                if (!e.target.checked) setIsSalesRevenue(false);
              }}
              className="h-4 w-4 rounded border-border focus:ring-2 focus:ring-focus-ring"
            />
            Tính vào lãi lỗ
          </label>

          {canBeSalesRevenue && (
            <div>
              <label className="flex items-center gap-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  name="is_sales_revenue"
                  checked={isSalesRevenue}
                  onChange={(e) => setIsSalesRevenue(e.target.checked)}
                  className="h-4 w-4 rounded border-border focus:ring-2 focus:ring-focus-ring"
                />
                Tính là doanh thu bán hàng
              </label>
              <p className="mt-1 text-xs text-text-muted">
                Đánh dấu khi tiền của nhóm này là tiền bán hàng ghi tay. Trang Lãi lỗ cộng vào dòng Doanh thu thay vì Thu khác.
              </p>
            </div>
          )}
        </form>
      </FormModal>
    </>
  );
}
