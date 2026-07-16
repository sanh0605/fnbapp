"use client";

import { useState } from "react";
import { saveCategory as saveProductCategory, updateCategory as updateProductCategory, deleteCategory as deleteProductCategory } from "@/app/admin/products/categories/actions";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { alert, confirm } from "@/lib/dialog";

export default function ProductCategoryForm({ initialData }: any) {
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [name, setName] = useState(initialData?.name || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData();
    formData.append("name", name);
    
    if (isEdit) {
      formData.append("id", initialData.id);
      await updateProductCategory(formData);
    } else {
      await saveProductCategory(formData);
    }
    
    setLoading(false);
    setIsOpen(false);
    if (!isEdit) setName("");
  };

  const handleDelete = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("id", initialData.id);
    const res = await deleteProductCategory(formData);
    setLoading(false);
    if (res?.error) {
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
    } else {
      setIsDeleteOpen(false);
    }
  };

  return (
    <>
      {!isEdit ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition shadow-sm"
        >
          + Thêm Nhóm Mới
        </button>
      ) : (
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setIsOpen(true)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
            Sửa
          </button>
          <button type="button" onClick={() => setIsDeleteOpen(true)} className="text-sm font-medium text-red-600 hover:text-red-800">
            Xoá
          </button>
        </div>
      )}

      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-border flex justify-between items-center bg-page/50">
              <h2 className="text-xl font-bold text-text-primary">
                {isEdit ? "Sửa Nhóm Món" : "Thêm Nhóm Món"}
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-secondary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <form id={isEdit ? `editCat-${initialData.id}` : "addCat"} onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-text-primary mb-1">Tên Nhóm (VD: Trà Sữa, Cà Phê)</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-orange-500"
                    placeholder="Nhập tên nhóm..."
                  />
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-border bg-page flex justify-end gap-3">
              <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-text-secondary font-medium hover:bg-border rounded-lg transition">Huỷ</button>
              <button 
                type="submit" 
                form={isEdit ? `editCat-${initialData.id}` : "addCat"} 
                disabled={loading || !name} 
                className="px-5 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? "Đang xử lý..." : "Lưu Nhóm"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {isDeleteOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center gap-3 bg-red-50/50">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-text-primary">
                Xác nhận xoá
              </h2>
            </div>
            <div className="p-5">
              <p className="text-text-secondary text-sm text-left">
                Bạn có chắc chắn muốn xoá nhóm <span className="font-bold text-text-primary">{initialData.name}</span> không?<br/>
                Thao tác này không thể hoàn tác.
              </p>
            </div>
            <div className="p-4 border-t border-border bg-page flex justify-end gap-3">
              <button type="button" onClick={() => setIsDeleteOpen(false)} className="px-4 py-2 text-text-secondary font-medium hover:bg-border rounded-lg transition">
                Huỷ
              </button>
              <button 
                type="button" 
                onClick={handleDelete} 
                disabled={loading} 
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? "Đang xử lý..." : "Xoá Nhóm"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
