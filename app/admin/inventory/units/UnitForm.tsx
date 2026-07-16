"use client";

import { useState, useId } from "react";
import { addUnit, updateUnit, deleteUnit } from "@/app/admin/inventory/actions";
import { alert, confirm } from "@/lib/dialog";

export function UnitForm({ initialData }: { initialData?: any }) {
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    if (isEdit) {
      formData.append("id", initialData.id);
      await updateUnit(formData);
    } else {
      await addUnit(formData);
    }
    setLoading(false);
    setIsOpen(false);
  }

  return (
    <>
      {isEdit ? (
        <button onClick={() => setIsOpen(true)} className="text-primary hover:text-primary-active text-sm font-medium">Sửa</button>
      ) : (
        <button onClick={() => setIsOpen(true)} className="bg-primary text-white px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition transition">
          + Thêm Đơn vị
        </button>
      )}
      
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-surface-card rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">{isEdit ? "Sửa Đơn Vị" : "Thêm Đơn Vị Mới"}</h2>
            <form action={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">Tên đơn vị (VD: gram, hộp)</label>
                <input id={`${formId}-name`} type="text" name="name" defaultValue={initialData?.name} required className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-focus-ring outline-none" />
              </div>
              <div>
                <label htmlFor={`${formId}-description`} className="block text-sm font-medium text-text-secondary mb-1">Ghi chú thêm</label>
                <input id={`${formId}-description`} type="text" name="description" defaultValue={initialData?.description} className="w-full border border-border rounded-lg px-3 py-2 focus:ring-2 focus:ring-focus-ring outline-none" placeholder="Không bắt buộc" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg text-sm">Huỷ</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-primary text-white px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition disabled:opacity-50">
                  {loading ? "Đang lưu..." : "Lưu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteBtn({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  
  const handleDelete = async () => {
    if (await confirm({ title: "Xác nhận xóa", message: "Xác nhận xoá đơn vị này?", variant: "danger" })) {
      setLoading(true);
      const fd = new FormData();
      fd.append("id", id);
      await deleteUnit(fd);
      setLoading(false);
    }
  };

  return (
    <button 
      onClick={handleDelete} 
      disabled={loading}
      className="text-danger hover:text-danger-active text-sm font-medium disabled:opacity-50"
    >
      {loading ? "..." : "Xoá"}
    </button>
  );
}
