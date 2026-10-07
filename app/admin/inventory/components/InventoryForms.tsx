"use client";

import { useState } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { alert, confirm } from "@/lib/shared/dialog";
import { Button } from "@/components/ui/Button";

// Re-export forms from sub-components
export { ItemCategoryForm, CategoryForm } from "./CategoryForm";

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
          <Button type="button" variant="secondary" onClick={onEdit}>
            Sửa
          </Button>
        )}
        <Button
          type="button"
          variant="delete"
          onClick={() => setIsDeleteOpen(true)}
          disabled={loading}
        >
          {loading ? "..." : "Xoá"}
        </Button>
      </div>

      {isDeleteOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
            <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
              <div className="p-5 border-b border-border flex items-center gap-3 bg-danger/10/50">
                <div className="w-10 h-10 rounded-full bg-danger/10 flex items-center justify-center text-danger shrink-0">
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsDeleteOpen(false)}
                >
                  Huỷ
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  onClick={performDelete}
                  loading={loading}
                >
                  {loading ? "Đang xử lý..." : "Xác nhận xoá"}
                </Button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
