"use client";

import { useState } from "react";
import { addItemCategory, updateItemCategory } from "@/app/admin/inventory/actions";
import { ModalPortal } from "@/components/ui/ModalPortal";

export function CategoryForm({ initialData }: { initialData?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    if (isEdit) {
      formData.append("id", initialData.id);
      await updateItemCategory(formData);
    } else {
      await addItemCategory(formData);
    }
    setLoading(false);
    setIsOpen(false);
  }

  return (
    <>
      {isEdit ? (
        <button onClick={() => setIsOpen(true)} className="text-primary hover:text-primary text-sm font-medium">
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-primary-hover transition"
        >
          + Phân loại Hàng Hoá
        </button>
      )}

      {isOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
            <div className="bg-surface-card rounded-2xl p-6 w-full max-w-md shadow-xl">
              <h2 className="text-lg font-bold mb-4">{isEdit ? "Sửa Phân Loại" : "Tạo Phân Loại Hàng Hoá"}</h2>
              <form action={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Tên Phân Loại (VD: Nguyên liệu khô, Bao bì)
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={initialData?.name}
                    required
                    className="w-full border border-border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">Đặc tính (System Type)</label>
                  <select
                    name="system_type"
                    defaultValue={initialData?.system_type}
                    className="w-full border border-border rounded-lg px-3 py-2"
                  >
                    <option value="RAW">Thuộc nhóm Nguyên liệu (Có tính quy đổi, có trong công thức)</option>
                    <option value="CONSUMABLE">Thuộc nhóm Vật tư (Kiểm kê định kỳ)</option>
                    <option value="EQUIPMENT">Thuộc nhóm Dụng cụ</option>
                  </select>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg text-sm"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50"
                  >
                    Lưu
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

// Aliased export for backward compatibility
export { CategoryForm as ItemCategoryForm };
