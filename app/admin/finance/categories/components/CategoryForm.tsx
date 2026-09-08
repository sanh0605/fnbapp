"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { addCashCategory, updateCashCategory } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBCashCategory } from "@/types/db";

interface CategoryFormProps {
  // Present -> edit this category. Absent -> add a new one. Same fields,
  // same modal, same shape as app/admin/outlets/components/OutletForm.tsx.
  category?: DBCashCategory;
}

export function CategoryForm({ category }: CategoryFormProps) {
  const isEdit = !!category;
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
              name="kind"
              defaultValue={category?.kind ?? "EXPENSE"}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card text-text-primary"
            >
              <option value="EXPENSE">Chi</option>
              <option value="INCOME">Thu</option>
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              name="affects_pnl"
              defaultChecked={category ? category.affects_pnl : true}
              className="h-4 w-4 rounded border-border focus:ring-2 focus:ring-focus-ring"
            />
            Tính vào lãi lỗ
          </label>
        </form>
      </FormModal>
    </>
  );
}
