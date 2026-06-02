"use client";

import { useState } from "react";
import { addBrand, deleteBrand, editBrand } from "@/app/actions/brands";
import { CustomDatePicker } from "./CustomDatePicker";

export function BrandForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    if (selectedDate) {
      // Ensure we send YYYY-MM-DD to the backend
      const offset = selectedDate.getTimezoneOffset();
      const localDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
      formData.set("start_date", localDate.toISOString().split('T')[0]);
    }
    await addBrand(formData);
    setLoading(false);
    setIsOpen(false);
    setSelectedDate(null);
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
      >
        + Thêm Thương Hiệu
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">Thêm Thương Hiệu Mới</h2>
            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Thương Hiệu</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500" 
                  placeholder="VD: Phin Đi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã Đơn Hàng (3 ký tự)</label>
                <input 
                  type="text" 
                  name="code" 
                  maxLength={3}
                  required 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 uppercase" 
                  placeholder="VD: PHD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu hoạt động</label>
                <CustomDatePicker
                  selected={selectedDate}
                  onChange={(date: Date | null) => setSelectedDate(date)}
                  dateFormat="dd/MM/yyyy"
                  showTimeSelect={false}
                  placeholderText="DD/MM/YYYY"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Huỷ
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {loading ? "Đang lưu..." : "Lưu Thương Hiệu"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteBrandButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <button 
      onClick={async () => {
        if (confirm("Bạn có chắc chắn muốn xoá thương hiệu này?")) {
          setLoading(true);
          const formData = new FormData();
          formData.append("id", id);
          await deleteBrand(formData);
          setLoading(false);
        }
      }}
      disabled={loading}
      className="text-red-600 hover:text-red-800 font-medium text-sm disabled:opacity-50"
    >
      {loading ? "..." : "Xoá"}
    </button>
  );
}

export function EditBrandButton({ brand }: { brand: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(brand.start_date ? new Date(brand.start_date) : null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.append("id", brand.id);
    if (selectedDate) {
      const offset = selectedDate.getTimezoneOffset();
      const localDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
      formData.set("start_date", localDate.toISOString().split('T')[0]);
    } else {
      formData.delete("start_date");
    }
    await editBrand(formData);
    setLoading(false);
    setIsOpen(false);
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-4"
      >
        Sửa
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl text-left">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Sửa Thương Hiệu</h2>
            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Thương Hiệu</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  defaultValue={brand.name}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-gray-900" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mã Đơn Hàng (3 ký tự)</label>
                <input 
                  type="text" 
                  name="code" 
                  maxLength={3}
                  required 
                  defaultValue={brand.code}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 uppercase text-gray-900" 
                  placeholder="VD: PHD"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu hoạt động</label>
                <CustomDatePicker
                  selected={selectedDate}
                  onChange={(date: Date | null) => setSelectedDate(date)}
                  dateFormat="dd/MM/yyyy"
                  showTimeSelect={false}
                  placeholderText="DD/MM/YYYY"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-gray-900"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Huỷ
                </button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400"
                >
                  {loading ? "Đang lưu..." : "Cập nhật"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
