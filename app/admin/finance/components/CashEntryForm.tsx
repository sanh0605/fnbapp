"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addCashEntry, updateCashEntry } from "../actions";
import { Button } from "@/components/ui/Button";
import { DayInput } from "@/components/ui/DayInput";
import { Field } from "@/components/ui/Field";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { safeReturnTo } from "./return-to";
import type { DBBankAccount, DBCashCategory, DBCashEntry } from "@/types/db";

interface CashEntryFormProps {
  // Present -> edit this entry. Absent -> add a new one.
  entry?: DBCashEntry;
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
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
  const [day, setDay] = useState(entry?.entry_date ?? today ?? "");
  const [dayError, setDayError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">(
    entry?.payment_method ?? "CASH",
  );

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
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
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
              defaultValue={entry?.category_id ?? ""}
            >
              <option value="" disabled>Chọn nhóm</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>

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
                <option value="" disabled>Chọn tài khoản</option>
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
              />
            </Field>
          </div>
        </div>

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
            {isEdit ? "Cập nhật" : "Lưu"}
          </Button>
        </div>
      </form>
    </div>
  );
}
