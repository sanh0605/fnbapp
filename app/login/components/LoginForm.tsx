"use client";

import { useState, useRef, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

function getSafeCallbackUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) {
      return null;
    }
    const path = url.pathname + url.search + url.hash;
    if (path.startsWith("//")) {
      return null;
    }
    return path;
  } catch {
    return null;
  }
}

function LoginFormContent({ title }: { title: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const usernameInputRef = useRef<HTMLInputElement>(null);

  const rawCallbackUrl = searchParams?.get("callbackUrl");

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
        setError("Sai tên đăng nhập hoặc mật khẩu");
        setLoading(false);
        usernameInputRef.current?.focus();
      } else {
        // Lấy session để kiểm tra role
        const { getSession } = await import("next-auth/react");
        const session = await getSession();

        const safeUrl = getSafeCallbackUrl(rawCallbackUrl);
        if (safeUrl) {
          router.push(safeUrl);
        } else if (session?.user && (session.user as any).role === "STAFF") {
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
          <h2 className="text-3xl font-bold text-text-primary">{title}</h2>
        </div>

        {error && (
          <div aria-live="polite" className="bg-danger/10 text-danger p-3 rounded-lg text-sm text-center mb-4 border border-danger/20">
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
              placeholder="Ví dụ: nhanvien01"
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-text-primary mb-1">
              Mật khẩu
            </label>
            <input
              id="password"
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
            className="w-full bg-primary text-on-primary font-semibold py-2.5 rounded-lg hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none transition-colors flex justify-center items-center disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              "Đăng nhập"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginForm(props: { title: string }) {
  return (
    <Suspense fallback={null}>
      <LoginFormContent {...props} />
    </Suspense>
  );
}
