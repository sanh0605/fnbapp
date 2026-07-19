"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { reportClientError } from "@/lib/client-error-report";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
    void reportClientError("global-error", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4" role="alert" aria-live="assertive">
      <div className="bg-surface-card border border-border rounded-card shadow-lg p-6 max-w-md w-full text-center">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-warning/10 rounded-full mb-4">
          <AlertTriangle className="w-6 h-6 text-warning" />
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-2">Đã xảy ra lỗi</h2>
        <p className="text-sm text-text-secondary mb-4">
          Ứng dụng gặp sự cố không mong muốn. Vui lòng thử lại.
        </p>
        {error.digest && (
          <p className="text-xs text-text-muted mb-4 font-mono">Mã lỗi: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center justify-center bg-primary text-white font-medium px-4 py-2 rounded-button hover:bg-primary-hover transition-colors min-h-[44px] w-full sm:w-auto"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
