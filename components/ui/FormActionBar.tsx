"use client";

import { Children, useEffect, useRef, useState } from "react";
import { Button } from "./Button";

export interface FormActionBarProps {
  mode: "create" | "edit";
  loading?: boolean;          // while submitting
  onCancel: () => void;       // "Bỏ" / "Bỏ thay đổi"
  submitLabel?: string;
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

    return () => {
      form.removeEventListener("input", handleDirty);
      form.removeEventListener("change", handleDirty);
    };
  }, []);

  const primaryLabel = loading
    ? "Đang lưu…"
    : submitLabel ?? (mode === "edit" ? "Lưu thay đổi" : "Tạo");

  const secondaryLabel = mode === "edit" ? "Bỏ thay đổi" : "Bỏ";

  const hasChildren = Children.toArray(children).length > 0;

  return (
    <div
      ref={barRef}
      className="sticky bottom-[calc(58px+env(safe-area-inset-bottom))] md:bottom-0 z-30 bg-surface-card border-t border-border py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
    >
      <div className="text-sm text-text-muted">
        {isDirty ? "Có thay đổi chưa lưu" : null}
      </div>
      <div
        className={`${
          hasChildren
            ? "flex flex-col md:flex-row md:items-center md:justify-end md:ml-auto"
            : "grid grid-cols-2 md:flex md:items-center md:justify-end md:ml-auto"
        } gap-3`}
      >
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
