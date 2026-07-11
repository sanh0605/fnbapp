"use client";

import { useState, useId } from "react";
import { saveCategory, updateCategory, deleteCategory } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import type { DBProductCategory } from "@/types/db";

interface ProductCategoryFormProps {
  initialData?: DBProductCategory;
}

export function ProductCategoryForm({ initialData }: ProductCategoryFormProps) {
  const formId = useId();
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    if (isEdit && initialData) {
      formData.append("id", initialData.id);
    }
    const fn = isEdit ? updateCategory : saveCategory;
    const res = await fn(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
    }
  }

  async function handleDelete() {
    const formData = new FormData();
    if (initialData) {
      formData.append("id", initialData.id);
      await deleteCategory(formData);
    }
  }

  return (
    <>
      {isEdit ? (
        <div className="flex items-center">
          <button
            onClick={() => setIsOpen(true)}
            className="text-primary hover:text-primary-hover font-medium text-sm mr-4"
          >
            Sửa
          </button>
          <button
            onClick={() => setIsDeleteOpen(true)}
            className="text-danger hover:text-danger-active font-medium text-sm"
          >
            Xóa
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition transition"
        >
          + Thêm Danh Mục
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title={isEdit ? "Sửa Danh Mục" : "Thêm Danh Mục Mới"}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium"
            >
              Hủy
            </button>
            <LoadingButton
              type="submit"
              form="category-form"
              loading={loading}
              loadingText="Đang lưu..."
            >
              {isEdit ? "Cập nhật" : "Lưu Danh Mục"}
            </LoadingButton>
          </>
        }
      >
        <form id="category-form" action={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
              {error}
            </div>
          )}
          <div>
            <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">
              Tên Danh Mục
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              name="name"
              required
              defaultValue={initialData?.name}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="VD: Cà phê, Trà sữa..."
            />
          </div>
        </form>
      </FormModal>

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        description={`Bạn có chắc chắn muốn xóa danh mục "${initialData?.name}"?`}
      />
    </>
  );
}
