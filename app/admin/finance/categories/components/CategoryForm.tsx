"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addCashCategory, updateCashCategory } from "../actions";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { confirm } from "@/lib/shared/dialog";
import { safeReturnTo } from "@/lib/shared/return-to";
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
// handleSubmit in a test.
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
  const savingRef = useRef(false);
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
    if (savingRef.current) return;
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

    savingRef.current = true;
    setLoading(true);
    if (isEdit && category) formData.set("id", category.id);
    try {
      const result = isEdit ? await updateCashCategory(formData) : await addCashCategory(formData);

      if (result.error) {
        savingRef.current = false;
        setLoading(false);
        setError(result.error);
        return;
      }
      router.push(returnTo);
      router.refresh();
    } catch {
      savingRef.current = false;
      setLoading(false);
      setError("Không lưu được. Kiểm tra mạng rồi bấm lại.");
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger">
            {error}
          </Alert>
        )}

        <div data-testid="form-fields" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
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

          <div className="space-y-2">
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
          </div>
        </div>

        <FormActionBar
          mode={isEdit ? "edit" : "create"}
          loading={loading}
          onCancel={() => router.push(returnTo)}
        />
      </form>
    </div>
  );
}
