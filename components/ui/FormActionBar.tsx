"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

export interface FormActionBarProps {
  mode: "create" | "edit";
  loading?: boolean;          // while submitting
  onCancel: () => void;       // "Bỏ" / "Bỏ thay đổi"
  submitLabel?: React.ReactNode;
  disabled?: boolean;
  onSubmit?: () => void;
  children?: React.ReactNode;
}

export function FormActionBar({
  mode,
  loading = false,
  onCancel,
  submitLabel,
  disabled = false,
  onSubmit,
  children,
}: FormActionBarProps) {
  const [isDirty, setIsDirty] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const form = barRef.current?.closest("form");
    if (!form) return;

    const handleDirty = () => {
      setIsDirty(true);
    };

    form.addEventListener("input", handleDirty);
    form.addEventListener("change", handleDirty);

    const scrollParent = barRef.current?.closest(".overflow-y-auto") as HTMLElement | null;
    const targetToObserve = (scrollParent?.firstElementChild as HTMLElement | null) ?? form;

    const updatePosition = () => {
      const el = barRef.current;
      if (!el) return;
      el.style.marginTop = "";
      const base = parseFloat(getComputedStyle(el).marginTop) || 0;
      const parentBottom = scrollParent
        ? scrollParent.getBoundingClientRect().bottom
        : window.innerHeight;
      const target = parentBottom - (parseFloat(getComputedStyle(el).bottom) || 0);
      const currentBottom = el.getBoundingClientRect().bottom + (scrollParent?.scrollTop ?? 0);
      const paddingBottom = targetToObserve
        ? parseFloat(getComputedStyle(targetToObserve).paddingBottom) || 0
        : 0;
      if (currentBottom > 0 && parentBottom > 0) {
        const diff = target - currentBottom - paddingBottom;
        if (diff > 0) {
          el.style.marginTop = `${base + diff}px`;
          const scroller = scrollParent ?? document.scrollingElement;
          const over = scroller ? scroller.scrollHeight - scroller.clientHeight : 0;
          if (over > 0) el.style.marginTop = `${Math.max(base, base + diff - over)}px`;
        }
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && targetToObserve) {
      observer = new ResizeObserver(updatePosition);
      observer.observe(targetToObserve);
    }

    return () => {
      form.removeEventListener("input", handleDirty);
      form.removeEventListener("change", handleDirty);
      window.removeEventListener("resize", updatePosition);
      observer?.disconnect();
    };
  }, []);

  const primaryLabel = loading
    ? "Đang lưu…"
    : submitLabel ?? (mode === "edit" ? "Lưu thay đổi" : "Tạo");

  const secondaryLabel = mode === "edit" ? "Bỏ thay đổi" : "Bỏ";

  return (
    <div
      ref={barRef}
      className="sticky bottom-[calc(58px+env(safe-area-inset-bottom))] md:bottom-0 z-30 bg-surface-card border-t border-border py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
    >
      {isDirty ? (
        <div className="text-sm text-text-muted">
          Có thay đổi chưa lưu
        </div>
      ) : null}
      <div className="flex items-center gap-2 md:gap-3 md:justify-end md:ml-auto w-full md:w-auto [&>*]:flex-1 [&>*]:min-w-0 [&>*]:text-center md:[&>*]:flex-initial [&>*]:px-2 md:[&>*]:px-4">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
          className="w-full md:w-auto"
        >
          {secondaryLabel}
        </Button>
        {children}
        <Button
          type={onSubmit ? "button" : "submit"}
          variant="primary"
          onClick={onSubmit}
          loading={loading}
          disabled={loading || disabled}
          className="w-full md:w-auto"
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
