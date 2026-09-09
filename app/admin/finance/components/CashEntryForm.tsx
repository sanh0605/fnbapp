"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addCashEntry, updateCashEntry } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBBankAccount, DBCashCategory, DBCashEntry } from "@/types/db";

interface CashEntryFormProps {
  // Present -> edit this entry. Absent -> add a new one. Same fields, same
  // modal, same shape as app/admin/finance/bank-accounts/components/BankAccountForm.tsx.
  entry?: DBCashEntry;
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
}

export function CashEntryForm({ entry, categories, accounts }: CashEntryFormProps) {
  const isEdit = !!entry;
  const formId = useId();
  // useRouter() throws outside an App Router context. This form is rendered
  // from CashEntriesList inside that render test (which does not mount one
  // and does not mock next/navigation), so the fallback keeps the initial
  // render safe there; router.refresh() only ever runs after a real write.
  let router: ReturnType<typeof useRouter> | null;
  try {
    router = useRouter();
  } catch {
    router = null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  function handleClose() {
    setIsOpen(false);
    setError(null);
  }

  function handleOpen() {
    setPaymentMethod(entry?.payment_method ?? "CASH");
    setIsOpen(true);
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (isEdit && entry) formData.set("id", entry.id);
    const result = isEdit ? await updateCashEntry(formData) : await addCashEntry(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setIsOpen(false);
    router?.refresh();
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={handleOpen}
          className="text-primary hover:text-primary-hover font-medium text-sm"
        >
          Sửa
        </button>
      ) : (
        <button
          onClick={handleOpen}
          className="bg-primary text-white px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition"
        >
          + Ghi khoản mới
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        title={isEdit ? "Sửa dòng sổ" : "Ghi khoản thu chi"}
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
              {isEdit ? "Cập nhật" : "Lưu"}
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
            <label htmlFor={`${formId}-entry_date`} className="block text-sm font-medium text-text-secondary mb-1">
              Ngày
            </label>
            <input
              id={`${formId}-entry_date`}
              type="date"
              name="entry_date"
              required
              defaultValue={entry?.entry_date}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-category_id`} className="block text-sm font-medium text-text-secondary mb-1">
              Nhóm thu chi
            </label>
            <select
              id={`${formId}-category_id`}
              name="category_id"
              required
              defaultValue={entry?.category_id ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
            >
              <option value="" disabled>Chọn nhóm</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${formId}-amount`} className="block text-sm font-medium text-text-secondary mb-1">
              Số tiền (đồng)
            </label>
            <input
              id={`${formId}-amount`}
              type="number"
              inputMode="numeric"
              name="amount"
              required
              min={1}
              step={1}
              defaultValue={entry?.amount}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="VD: 1371000"
            />
          </div>

          <div>
            <label htmlFor={`${formId}-payment_method`} className="block text-sm font-medium text-text-secondary mb-1">
              Cách trả
            </label>
            <select
              id={`${formId}-payment_method`}
              name="payment_method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH")}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
            >
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </select>
          </div>

          {/* Cash never needs an account -- the field is not rendered at
              all when it does not apply, not rendered-and-disabled. */}
          {paymentMethod === "BANK_TRANSFER" && (
            <div>
              <label htmlFor={`${formId}-bank_account_id`} className="block text-sm font-medium text-text-secondary mb-1">
                Tài khoản
              </label>
              <select
                id={`${formId}-bank_account_id`}
                name="bank_account_id"
                required
                defaultValue={entry?.bank_account_id ?? ""}
                className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary bg-surface-card"
              >
                <option value="" disabled>Chọn tài khoản</option>
                {accountOptions.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor={`${formId}-note`} className="block text-sm font-medium text-text-secondary mb-1">
              Ghi chú
            </label>
            <input
              id={`${formId}-note`}
              type="text"
              name="note"
              defaultValue={entry?.note ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="Không bắt buộc"
            />
          </div>
        </form>
      </FormModal>
    </>
  );
}
