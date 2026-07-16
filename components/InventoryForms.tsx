"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { alert, confirm } from "@/lib/dialog";

// Re-export forms from sub-components
export { ItemCategoryForm, CategoryForm } from "./inventory/CategoryForm";
export { BaseIngredientForm } from "./inventory/BaseIngredientForm";
export { PurchasedItemForm } from "./inventory/PurchasedItemForm";
export { ConversionForm } from "./inventory/ConversionForm";

// Reusable Action Group (Sửa / Xoá)
export function ActionGroup({
  id,
  deleteFn,
  onEdit,
}: {
  id: string;
  deleteFn: any;
  onEdit?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const performDelete = async () => {
    setLoading(true);
    const fd = new FormData();
    fd.append("id", id);
    const res = await deleteFn(fd);
    setLoading(false);
    if (res?.error) {
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
    } else {
      setIsDeleteOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-3">
        {onEdit && (
          <button onClick={onEdit} className="text-primary hover:text-primary text-sm font-medium">
            Sửa
          </button>
        )}
        <button
          type="button"
          onClick={() => setIsDeleteOpen(true)}
          disabled={loading}
          className="text-red-500 hover:text-red-700 text-sm font-medium"
        >
          {loading ? "..." : "Xoá"}
        </button>
      </div>

      {isDeleteOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="p-5 border-b border-border flex items-center gap-3 bg-red-50/50">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-text-primary">Xác nhận xoá</h2>
              </div>
              <div className="p-5">
                <p className="text-text-secondary text-sm text-left">
                  Bạn có chắc chắn muốn xoá mục này không?
                  <br />
                  Thao tác này không thể hoàn tác.
                </p>
              </div>
              <div className="p-4 border-t border-border bg-page flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteOpen(false)}
                  className="px-4 py-2 text-text-secondary font-medium hover:bg-border rounded-lg transition"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  onClick={performDelete}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition shadow-sm"
                >
                  {loading ? "Đang xử lý..." : "Xác nhận xoá"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

// Reusable Delete Button (Backward compatibility if needed)
export function DeleteBtn({ id, actionFn }: { id: string; actionFn: any }) {
  return <ActionGroup id={id} deleteFn={actionFn} />;
}
