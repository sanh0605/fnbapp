"use client";

import { useState } from "react";
import { updateUser } from "@/app/admin/users/actions";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function EditUserForm({ user }: { user: any }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setError("");
    setLoading(true);
    // Append the user ID to the formData
    formData.append("id", user.id);
    
    const res = await updateUser(formData);
    setLoading(false);
    
    if (res?.error) {
      setError(res.error);
    } else {
      router.push("/admin/users");
      router.refresh();
    }
  }

  return (
    <div className="bg-surface-card rounded-xl shadow-sm border border-border p-6 max-w-xl">
      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>}

      <form action={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Tên đăng nhập</label>
          <input 
            type="text" 
            value={user.username} 
            disabled
            className="w-full border border-border bg-page text-text-secondary rounded-lg px-3 py-2.5 outline-none cursor-not-allowed" 
          />
          <p className="text-xs text-text-muted mt-1">Tên đăng nhập không thể thay đổi.</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Mật khẩu mới</label>
          <input 
            type="password" 
            name="password" 
            className="w-full border border-border rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors" 
            placeholder="Để trống nếu không muốn đổi mật khẩu"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1.5">Phân quyền</label>
          <select 
            name="role" 
            required 
            defaultValue={user.role}
            className="w-full border border-border rounded-lg px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors bg-surface-card"
          >
            <option value="STAFF">Staff (Bán hàng)</option>
            <option value="MANAGER">Manager (Quản lý)</option>
            <option value="ADMIN">Admin (Toàn quyền)</option>
          </select>
        </div>
        
        <div className="flex gap-3 pt-4 border-t border-border mt-6">
          <Link 
            href="/admin/users"
            className="flex-1 text-center px-4 py-2.5 text-text-primary font-medium border border-border bg-surface-card hover:bg-page rounded-lg transition-colors"
          >
            Huỷ
          </Link>
          <button 
            type="submit" 
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}
