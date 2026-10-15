"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addBankAccount, updateBankAccount } from "../actions";
import { Alert } from "@/components/ui/Alert";
import { Field } from "@/components/ui/Field";
import { FormActionBar } from "@/components/ui/FormActionBar";
import { TextInput } from "@/components/ui/TextInput";
import { safeReturnTo } from "@/lib/shared/return-to";
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
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savingRef.current) return;
    const formData = new FormData(e.currentTarget);
    savingRef.current = true;
    setLoading(true);
    setError(null);

    if (isEdit && account) formData.set("id", account.id);
    try {
      const result = isEdit ? await updateBankAccount(formData) : await addBankAccount(formData);

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

        <FormActionBar
          mode={isEdit ? "edit" : "create"}
          loading={loading}
          onCancel={() => router.push(returnTo)}
        />
      </form>
    </div>
  );
}
