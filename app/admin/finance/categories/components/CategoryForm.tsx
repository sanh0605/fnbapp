"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addCashCategory, updateCashCategory } from "../actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { confirm } from "@/lib/shared/dialog";
import { safeReturnTo } from "../../components/return-to";
import type { DBCashCategory } from "@/types/db";

interface CategoryFormProps {
  category?: DBCashCategory;
  hasEntries?: boolean;
  returnTo?: string;
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

export function CategoryForm({ category, hasEntries, returnTo: rawReturnTo }: CategoryFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/finance/categories");
  const isEdit = !!category;
  const isKindLocked = isEdit && !!hasEntries;
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [affectsPnl, setAffectsPnl] = useState(category ? category.affects_pnl : true);
  const [kind, setKind] = useState<"EXPENSE" | "INCOME">(category?.kind ?? "EXPENSE");
  const [isSalesRevenue, setIsSalesRevenue] = useState(category?.is_sales_revenue === true);
  // BR-CASH-006: only an income category that counts in profit and loss can
  // be sales revenue. Hidden otherwise, and cleared the moment either
  // condition goes away, so a hidden box can never submit "on".
  const canBeSalesRevenue = kind === "INCOME" && affectsPnl;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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
    router.push(returnTo);
    router.refresh();
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
        )}

        <Field label="Tên nhóm" htmlFor={`${formId}-name`} required>
          <TextInput
            id={`${formId}-name`}
            name="name"
            required
            defaultValue={category?.name}
            placeholder="Ví dụ: Vận hành"
          />
        </Field>

        <Field
          label="Bên"
          htmlFor={`${formId}-kind`}
          hint={isKindLocked ? "Đã có dòng sổ — không đổi được bên" : undefined}
        >
          <Select
            id={`${formId}-kind`}
            name={isKindLocked ? undefined : "kind"}
            disabled={isKindLocked}
            value={kind}
            onChange={(e) => {
              const next = e.target.value as "EXPENSE" | "INCOME";
              setKind(next);
              if (next !== "INCOME") setIsSalesRevenue(false);
            }}
          >
            <option value="EXPENSE">Chi</option>
            <option value="INCOME">Thu</option>
          </Select>
          {isKindLocked && (
            <input type="hidden" name="kind" value={category!.kind} />
          )}
        </Field>

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
              Đánh dấu khi tiền của nhóm này là tiền bán hàng ghi tay. Trang Báo cáo tài chính cộng vào dòng Doanh thu thay vì Thu khác.
            </p>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto"
          >
            Bỏ
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full sm:w-auto"
          >
            {isEdit ? "Cập nhật" : "Lưu nhóm"}
          </Button>
        </div>
      </form>
    </div>
  );
}
