"use client";

import React, { useEffect, useRef } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastKind = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
}

const KIND_CONFIG: Record<
  ToastKind,
  {
    border: string;
    iconColor: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  success: {
    border: "border-l-primary",
    iconColor: "text-primary",
    Icon: CheckCircle2,
  },
  error: {
    border: "border-l-danger",
    iconColor: "text-danger",
    Icon: AlertCircle,
  },
  warning: {
    border: "border-l-caution",
    iconColor: "text-caution",
    Icon: AlertTriangle,
  },
  info: {
    border: "border-l-info",
    iconColor: "text-info",
    Icon: Info,
  },
};

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  const timersRef = useRef<Map<string, { timer: ReturnType<typeof setTimeout>; kind: ToastKind }>>(new Map());
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const activeIds = new Set(toasts.map((t) => t.id));

    // Clear timers for toasts that were removed
    for (const [id, entry] of timersRef.current.entries()) {
      if (!activeIds.has(id)) {
        clearTimeout(entry.timer);
        timersRef.current.delete(id);
      }
    }

    // Set or update timers for active toasts
    for (const toast of toasts) {
      if (toast.kind === "error") {
        const existing = timersRef.current.get(toast.id);
        if (existing) {
          clearTimeout(existing.timer);
          timersRef.current.delete(toast.id);
        }
        continue;
      }

      const existing = timersRef.current.get(toast.id);
      if (existing && existing.kind === toast.kind) {
        continue;
      }
      if (existing) {
        clearTimeout(existing.timer);
      }

      const delay = toast.kind === "warning" ? 5000 : 3000;
      const timer = setTimeout(() => {
        timersRef.current.delete(toast.id);
        onDismissRef.current(toast.id);
      }, delay);
      timersRef.current.set(toast.id, { timer, kind: toast.kind });
    }
  }, [toasts]);

  useEffect(() => {
    return () => {
      for (const entry of timersRef.current.values()) {
        clearTimeout(entry.timer);
      }
      timersRef.current.clear();
    };
  }, []);

  const handleDismiss = (id: string) => {
    const existing = timersRef.current.get(id);
    if (existing) {
      clearTimeout(existing.timer);
      timersRef.current.delete(id);
    }
    onDismissRef.current(id);
  };

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Thông báo"
      className="fixed top-16 left-1/2 -translate-x-1/2 w-[min(92vw,28rem)] flex flex-col gap-2 z-[70]"
    >
      {toasts.map((toast) => {
        const config = KIND_CONFIG[toast.kind];
        const Icon = config.Icon;

        return (
          <div
            key={toast.id}
            className={`bg-surface-card border border-border border-l-4 rounded-card shadow-panel py-3 px-4 flex items-start gap-3 ${config.border}`}
          >
            <Icon className={`w-[22px] h-[22px] shrink-0 mt-0.5 ${config.iconColor}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-text-primary leading-snug">
                {toast.title}
              </p>
              {toast.detail && (
                <p className="text-[14px] text-text-secondary mt-0.5 leading-normal">
                  {toast.detail}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Đóng"
              onClick={() => handleDismiss(toast.id)}
              className="w-11 h-11 shrink-0 -my-1 -mr-2 flex items-center justify-center rounded-button text-text-muted hover:text-text-primary transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
