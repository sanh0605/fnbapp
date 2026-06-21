"use client";

import { useState } from "react";
import { addUser, deleteUser } from "@/app/actions/users";
import { ModalPortal } from "@/components/ui/ModalPortal";

export function UserForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(formData: FormData) {
    setError("");
    setLoading(true);
    const res = await addUser(formData);
    setLoading(false);
    
    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
    }
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
      >
        + Thêm Nhân Sự
      </button>

      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">Thêm Nhân Sự Mới</h2>
            
            {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                <input 
                  type="text" 
                  name="username" 
                  required 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500" 
                  placeholder="VD: nhanvien01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                <input 
                  type="password" 
                  name="password" 
                  required 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phân quyền</label>
                <select 
                  name="role" 
                  required 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                >
                  <option value="STAFF">Staff (Bán hàng)</option>
                  <option value="MANAGER">Manager (Quản lý)</option>
                  <option value="ADMIN">Admin (Toàn quyền)</option>
                </select>
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
                  {loading ? "Đang lưu..." : "Lưu Nhân Sự"}
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

export function DeleteUserButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <button 
      onClick={async () => {
        if (confirm("Bạn có chắc chắn muốn xoá tài khoản này?")) {
          setLoading(true);
          const formData = new FormData();
          formData.append("id", id);
          await deleteUser(formData);
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
