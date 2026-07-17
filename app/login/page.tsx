"use client";

import { useState, useRef } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const usernameInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(res.error);
        setLoading(false);
        usernameInputRef.current?.focus();
      } else {
        // Lấy session để kiểm tra role
        const { getSession } = await import("next-auth/react");
        const session = await getSession();
        
        if (session?.user && (session.user as any).role === "STAFF") {
          router.push("/pos");
        } else {
          router.push("/admin");
        }
        router.refresh();
      }
    } catch (err) {
      setError("Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.");
      setLoading(false);
      usernameInputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
      <div className="max-w-md w-full bg-surface-card rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-text-primary">Phin Đi</h2>
          <p className="text-text-secondary mt-2">Hệ thống Quản lý F&B V2</p>
        </div>

        {error && (
          <div aria-live="polite" className="bg-danger/10 text-danger p-3 rounded-lg text-sm text-center mb-4 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-text-primary mb-1">
              Tên đăng nhập
            </label>
            <input
              id="username"
              ref={usernameInputRef}
              type="text"
              required
              spellCheck={false}
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-primary focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none transition-colors"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tên đăng nhập…"
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1">
              Mật khẩu
            </label>
            <input
              id="password"
              ref={passwordInputRef}
              type="password"
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-focus-ring focus:border-primary focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mật khẩu…"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-semibold py-2.5 rounded-lg hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none transition-colors flex justify-center items-center disabled:bg-blue-400"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              "Đăng nhập"
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center text-sm text-text-muted">
          Powered by Next.js & Supabase
        </div>
      </div>
    </div>
  );
}
