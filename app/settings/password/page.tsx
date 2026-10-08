"use client";

import { useState, useId } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Button } from "@/components/ui/Button";

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
        <PageHeader
          title="Đổi mật khẩu"
          actions={
            <Link href="/pos" className="text-primary hover:underline text-sm">
              Về trang POS
            </Link>
          }
        />

        {error && (
          <div className="bg-danger/10 text-danger p-3 rounded-lg text-sm text-center mb-6 border border-danger/20">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-success/10 text-success p-3 rounded-lg text-sm text-center mb-6 border border-success/20">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Field label="Mật khẩu cũ" htmlFor={`${formId}-oldPassword`} required>
            <TextInput
              id={`${formId}-oldPassword`}
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </Field>

          <Field label="Mật khẩu mới" htmlFor={`${formId}-newPassword`} required>
            <TextInput
              id={`${formId}-newPassword`}
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          
          <Field label="Xác nhận mật khẩu mới" htmlFor={`${formId}-confirmPassword`} required>
            <TextInput
              id={`${formId}-confirmPassword`}
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </Field>

          <Button
            type="submit"
            variant="primary"
            loading={loading}
            className="w-full mt-2"
          >
            Cập nhật mật khẩu
          </Button>
        </form>
      </div>
    </div>
  );
}
