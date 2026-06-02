"use client";

import { useState } from "react";
import { addUnit, updateUnit, deleteUnit } from "@/app/actions/inventory";

export function UnitForm({ initialData }: { initialData?: any }) {
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
        <button onClick={() => setIsOpen(true)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Sửa</button>
      ) : (
        <button onClick={() => setIsOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Thêm Đơn vị
        </button>
      )}
      
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">{isEdit ? "Sửa Đơn Vị" : "Thêm Đơn Vị Mới"}</h2>
            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên đơn vị (VD: gram, hộp)</label>
                <input type="text" name="name" defaultValue={initialData?.name} required className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú thêm</label>
                <input type="text" name="description" defaultValue={initialData?.description} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Không bắt buộc" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Huỷ</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
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
    if (confirm("Xác nhận xoá đơn vị này?")) {
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
      className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50"
    >
      {loading ? "..." : "Xoá"}
    </button>
  );
}
