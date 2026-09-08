"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addBankAccount, updateBankAccount } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBBankAccount } from "@/types/db";

interface BankAccountFormProps {
  // Present -> edit this account. Absent -> add a new one. Same fields,
  // same modal, same shape as app/admin/finance/categories/components/CategoryForm.tsx.
  account?: DBBankAccount;
}

export function BankAccountForm({ account }: BankAccountFormProps) {
  const isEdit = !!account;
  const formId = useId();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setIsOpen(false);
    setError(null);
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (isEdit && account) formData.set("id", account.id);
    const result = isEdit ? await updateBankAccount(formData) : await addBankAccount(formData);

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
          + Thêm tài khoản
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={handleClose}
        title={isEdit ? "Sửa tài khoản ngân hàng" : "Thêm tài khoản ngân hàng"}
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
              {isEdit ? "Cập nhật" : "Lưu tài khoản"}
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
              name="account_number"
              defaultValue={account?.account_number ?? ""}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="VD: 0071001234567"
            />
          </div>
        </form>
      </FormModal>
    </>
  );
}
