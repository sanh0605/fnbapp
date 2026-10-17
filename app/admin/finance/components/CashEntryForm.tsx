"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addCashEntry, updateCashEntry } from "../actions";
import { DayInput } from "@/components/ui/DayInput";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { Alert } from "@/components/ui/Alert";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { safeReturnTo } from "@/lib/shared/return-to";
import { saigonToday } from "@/lib/shared/datetime";
import type { DBBankAccount, DBCashCategory, DBCashEntry, DBMonthlyExpenseItem } from "@/types/db";

interface CashEntryFormProps {
  // Present -> edit this entry. Absent -> add a new one.
  entry?: DBCashEntry;
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
  monthlyItems?: DBMonthlyExpenseItem[];
  initialMonthlyItemId?: string;
  month?: string;
  // M7: today in Asia/Saigon, the same value the page already computes for
  // DateRangeButton -- only used to default the add form's date. The edit
  // form always keeps the entry's own date.
  today?: string;
  returnTo?: string;
}

export function CashEntryForm({
  entry,
  categories,
  accounts,
  monthlyItems,
  initialMonthlyItemId,
  month,
  today,
  returnTo: rawReturnTo,
}: CashEntryFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/finance");
  const isEdit = !!entry;
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState(() => {
    if (entry?.entry_date) return entry.entry_date;
    const currentToday = today ?? saigonToday();
    if (initialMonthlyItemId && month) {
      const currentMonth = currentToday.slice(0, 7);
      if (month !== currentMonth) {
        const [y, m] = month.split("-").map(Number);
        const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
        return `${month}-${String(lastDay).padStart(2, "0")}`;
      }
      return currentToday;
    }
    return entry?.entry_date ?? today ?? "";
  });
  const [dayError, setDayError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">(
    entry?.payment_method ?? "CASH",
  );

  const [categoryId, setCategoryId] = useState(() => {
    if (entry?.category_id) return entry.category_id;
    if (!entry && initialMonthlyItemId && monthlyItems) {
      const it = monthlyItems.find((i) => i.id === initialMonthlyItemId);
      if (it) return it.cash_category_id;
    }
    return "";
  });

  const [monthlyItemId, setMonthlyItemId] = useState(() => {
    if (entry?.monthly_item_id) return entry.monthly_item_id;
    if (!entry && initialMonthlyItemId) return initialMonthlyItemId;
    return "";
  });

  const handleCategoryChange = (newCatId: string) => {
    setCategoryId(newCatId);
    const currentItem = monthlyItems?.find((i) => i.id === monthlyItemId);
    if (!currentItem || currentItem.cash_category_id !== newCatId) {
      setMonthlyItemId("");
    }
  };

  const chosenCategory = categories.find((c) => c.id === categoryId);
  const isExpense = chosenCategory?.kind === "EXPENSE";

  const availableMonthlyItems = (monthlyItems ?? []).filter((item) => {
    if (item.cash_category_id !== categoryId) return false;
    return item.status === "ACTIVE" || item.id === entry?.monthly_item_id;
  });

  // ACTIVE rows to pick from, plus this entry's own group/account even if it
  // has since been retired -- otherwise opening the edit form and saving
  // would silently drop it.
  const categoryOptions = categories.filter(
    (c) => c.status === "ACTIVE" || c.id === entry?.category_id,
  );
  const accountOptions = accounts.filter(
    (a) => a.status === "ACTIVE" || a.id === entry?.bank_account_id,
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingRef.current) return;
    if (!day || day === "invalid") {
      setDayError("Ngày không hợp lệ");
      return;
    }
    const formData = new FormData(e.currentTarget);
    savingRef.current = true;
    setLoading(true);
    setError(null);

    if (isEdit && entry) formData.set("id", entry.id);
    try {
      const result = isEdit ? await updateCashEntry(formData) : await addCashEntry(formData);

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
          <Alert variant="danger">{error}</Alert>
        )}

        <div data-testid="form-fields" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <DayInput
              label="Ngày"
              value={day}
              onChange={(v) => {
                setDay(v);
                setDayError("");
              }}
              error={dayError}
            />
            <input type="hidden" name="entry_date" value={day} />
          </div>

          <Field label="Nhóm thu chi" htmlFor={`${formId}-category_id`} required>
            <Select
              id={`${formId}-category_id`}
              name="category_id"
              required
              value={categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="" disabled data-placeholder>Chọn nhóm</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>

          {isExpense && (
            <Field label="Khoản chi hằng tháng" htmlFor={`${formId}-monthly_item_id`}>
              <Select
                id={`${formId}-monthly_item_id`}
                name="monthly_item_id"
                value={monthlyItemId}
                onChange={(e) => setMonthlyItemId(e.target.value)}
              >
                <option value="">Không gắn khoản nào</option>
                {availableMonthlyItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Số tiền (đồng)" htmlFor={`${formId}-amount`} required>
            <MoneyInput
              id={`${formId}-amount`}
              // BR-CASH-005: digits-only box that groups thousands itself
              // as the owner types -- see components/ui/MoneyInput.tsx.
              name="amount"
              required
              defaultValue={entry?.amount}
            />
          </Field>

          <Field label="Cách trả" htmlFor={`${formId}-payment_method`}>
            <Select
              id={`${formId}-payment_method`}
              name="payment_method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH")}
            >
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </Select>
          </Field>

          {/* Cash never needs an account -- the field is not rendered at
              all when it does not apply, not rendered-and-disabled. */}
          {paymentMethod === "BANK_TRANSFER" && (
            <Field label="Tài khoản" htmlFor={`${formId}-bank_account_id`} required>
              <Select
                id={`${formId}-bank_account_id`}
                name="bank_account_id"
                required
                defaultValue={entry?.bank_account_id ?? ""}
              >
                <option value="" disabled data-placeholder>Chọn tài khoản</option>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </Field>
          )}

          <div className="md:col-span-2">
            <Field label="Ghi chú (không bắt buộc)" htmlFor={`${formId}-note`}>
              <TextInput
                id={`${formId}-note`}
                name="note"
                type="text"
                defaultValue={entry?.note ?? ""}
                placeholder="Ví dụ: Tiền điện tháng 9"
                maxLength={500}
              />
            </Field>
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
