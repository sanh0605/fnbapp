"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { addSupplier, editSupplier, deleteSupplierAction } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { DeleteConfirmModal } from "@/components/ui/DeleteConfirmModal";
import { alert, confirm } from "@/lib/dialog";
import type { DBSupplier } from "@/types/db";

interface SupplierFormProps {
  initialData?: DBSupplier;
}

export function SupplierForm({ initialData }: SupplierFormProps) {
  const isEdit = !!initialData;
  const formId = useId();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // docs/superpowers/plans/2026-09-01-two-defects-the-owner-found-testing.md
  // section B: revalidatePath (in addSupplier/editSupplier) marks the
  // server cache stale but does not repaint this already-open page.
  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    if (isEdit && initialData) {
      formData.append("id", initialData.id);
    }
    const fn = isEdit ? editSupplier : addSupplier;
    let res = await fn(formData);
    if ((res as any).needsDuplicateWarning) {
      const approved = await confirm({
        title: "Tên gần giống một mục đã có",
        message: (res as any).needsDuplicateWarning.message,
        okText: "Món khác",
        cancelText: "Tôi gõ nhầm",
        variant: "warning",
      });
      if (approved) {
        formData.append("duplicate_warning_confirmed", "true");
        res = await fn(formData);
      } else {
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-primary hover:text-primary-hover font-medium text-sm mr-4"
        >
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition transition"
        >
          + Thêm Nhà Cung Cấp
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title={isEdit ? "Sửa Nhà Cung Cấp" : "Thêm Nhà Cung Cấp Mới"}
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
              form="supplier-form"
              loading={loading}
              loadingText="Đang lưu..."
            >
              {isEdit ? "Cập nhật" : "Lưu Nhà Cung Cấp"}
            </LoadingButton>
          </>
        }
      >
        <form id="supplier-form" action={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
              {error}
            </div>
          )}
          <div>
            <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">
              Tên Nhà Cung Cấp
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              name="name"
              required
              defaultValue={initialData?.name}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="VD: Cửa hàng ABC"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-phone`} className="block text-sm font-medium text-text-secondary mb-1">
              Số Điện Thoại
            </label>
            <input
              id={`${formId}-phone`}
              type="tel"
              name="phone"
              defaultValue={initialData?.phone}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="VD: 0901234567"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-tax-id`} className="block text-sm font-medium text-text-secondary mb-1">
              Mã Số Thuế
            </label>
            <input
              id={`${formId}-tax-id`}
              type="text"
              name="tax_id"
              defaultValue={initialData?.tax_id}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="VD: 0123456789"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-address`} className="block text-sm font-medium text-text-secondary mb-1">
              Địa Chỉ
            </label>
            <input
              id={`${formId}-address`}
              type="text"
              name="address"
              defaultValue={initialData?.address}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="VD: 123 Đường ABC, Quận XYZ"
            />
          </div>
          <div>
            <label htmlFor={`${formId}-links`} className="block text-sm font-medium text-text-secondary mb-1">
              Ghi chú / Links
            </label>
            <textarea
              id={`${formId}-links`}
              name="links"
              rows={2}
              defaultValue={initialData?.links}
              className="w-full border border-border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="Các liên kết hoặc ghi chú thêm..."
            />
          </div>
        </form>
      </FormModal>
    </>
  );
}

interface DeleteSupplierButtonProps {
  id: string;
}

export function DeleteSupplierButton({ id }: DeleteSupplierButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // docs/superpowers/plans/2026-09-01-two-defects-the-owner-found-testing.md
  // section A4b/B: the action's result was discarded -- a refusal failed in
  // total silence, and a successful delete never told the browser to
  // redraw.
  async function handleDelete() {
    setLoading(true);
    const formData = new FormData();
    formData.append("id", id);
    const res = await deleteSupplierAction(formData);
    setLoading(false);
    if (res?.error) {
      await alert({ title: "Không xoá được", message: res.error, variant: "danger" });
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={loading}
        className="text-danger hover:text-danger-active font-medium text-sm disabled:opacity-50"
      >
        {loading ? "..." : "Xóa"}
      </button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        description="Bạn có chắc chắn muốn xóa nhà cung cấp này? Các liên kết hàng hóa có thể bị ảnh hưởng."
      />
    </>
  );
}
