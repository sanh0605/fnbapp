"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addBankAccount, updateBankAccount } from "../actions";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { safeReturnTo } from "../../components/return-to";
import type { DBBankAccount } from "@/types/db";

interface BankAccountFormProps {
  account?: DBBankAccount;
  returnTo?: string;
}

export function BankAccountForm({ account, returnTo: rawReturnTo }: BankAccountFormProps) {
  const returnTo = safeReturnTo(rawReturnTo, "/admin/finance/bank-accounts");
  const isEdit = !!account;
  const formId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);

    if (isEdit && account) formData.set("id", account.id);
    const result = isEdit ? await updateBankAccount(formData) : await addBankAccount(formData);

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

        <div>
          <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">
            Tên gợi nhớ
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            name="name"
            required
            defaultValue={account?.name}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="VD: Vietcombank Sanh"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-bank_name`} className="block text-sm font-medium text-text-secondary mb-1">
            Ngân hàng
          </label>
          <input
            id={`${formId}-bank_name`}
            type="text"
            name="bank_name"
            defaultValue={account?.bank_name ?? ""}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="VD: Vietcombank"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-account_number`} className="block text-sm font-medium text-text-secondary mb-1">
            Số tài khoản
          </label>
          <input
            id={`${formId}-account_number`}
            type="text"
            inputMode="numeric"
            name="account_number"
            defaultValue={account?.account_number ?? ""}
            className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
            placeholder="VD: 0071001234567"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => router.push(returnTo)}
            className="w-full sm:w-auto px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium transition text-center"
          >
            Bỏ
          </button>
          <LoadingButton
            type="submit"
            loading={loading}
            loadingText="Đang lưu…"
            className="w-full sm:w-auto"
          >
            {isEdit ? "Cập nhật" : "Lưu tài khoản"}
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
