"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addBankAccount, updateBankAccount } from "../actions";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
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
    <div className="bg-surface-card rounded-2xl border border-border p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
            {error}
          </div>
        )}

        <div data-testid="form-fields" className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Tên gợi nhớ" htmlFor={`${formId}-name`} required>
            <TextInput
              id={`${formId}-name`}
              name="name"
              required
              defaultValue={account?.name}
              placeholder="Ví dụ: Vietcombank Sanh"
            />
          </Field>

          <Field label="Ngân hàng" htmlFor={`${formId}-bank_name`}>
            <TextInput
              id={`${formId}-bank_name`}
              name="bank_name"
              defaultValue={account?.bank_name ?? ""}
              placeholder="Ví dụ: Vietcombank"
            />
          </Field>

          <Field label="Số tài khoản" htmlFor={`${formId}-account_number`}>
            <TextInput
              id={`${formId}-account_number`}
              name="account_number"
              keypad="digits"
              defaultValue={account?.account_number ?? ""}
              placeholder="Ví dụ: 0071001234567"
            />
          </Field>
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
            {isEdit ? "Cập nhật" : "Lưu tài khoản"}
          </Button>
        </div>
      </form>
    </div>
  );
}
