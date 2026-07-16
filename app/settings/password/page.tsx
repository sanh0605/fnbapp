"use client";

import { useState, useId } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function ChangePasswordPage() {
  const formId = useId();
  const { data: session, status } = useSession();
  
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (status === "loading") {
    return <div className="p-8 text-center">Đang tải...</div>;
  }

  if (!session) {
    return <div className="p-8 text-center">Vui lòng đăng nhập</div>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }
    
    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    setLoading(true);
    
    const result = await changePasswordAction(oldPassword, newPassword);
    
    if (result.success) {
      setSuccess("Đổi mật khẩu thành công!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setError(result.error || "Có lỗi xảy ra");
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-page p-8">
      <div className="max-w-md mx-auto bg-surface-card rounded-xl shadow-lg p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">Đổi mật khẩu</h1>
          <Link href="/pos" className="text-primary hover:underline text-sm">
            Về trang POS
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center mb-6 border border-red-200">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm text-center mb-6 border border-green-200">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor={`${formId}-oldPassword`} className="block text-sm font-medium text-text-primary mb-1">
              Mật khẩu cũ
            </label>
            <input
              id={`${formId}-oldPassword`}
              type="password"
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-primary outline-none"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor={`${formId}-newPassword`} className="block text-sm font-medium text-text-primary mb-1">
              Mật khẩu mới
            </label>
            <input
              id={`${formId}-newPassword`}
              type="password"
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-primary outline-none"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          
          <div>
            <label htmlFor={`${formId}-confirmPassword`} className="block text-sm font-medium text-text-primary mb-1">
              Xác nhận mật khẩu mới
            </label>
            <input
              id={`${formId}-confirmPassword`}
              type="password"
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-primary outline-none"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg hover:bg-primary-hover transition-colors flex justify-center items-center disabled:bg-blue-400 mt-2"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              "Cập nhật mật khẩu"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
