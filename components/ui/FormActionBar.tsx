"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./Button";

export interface FormActionBarProps {
  mode: "create" | "edit";
  loading?: boolean;          // while submitting
  onCancel: () => void;       // "Bỏ" / "Bỏ thay đổi"
}

export function FormActionBar({
  mode,
  loading = false,
  onCancel,
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
    : (mode === "edit" ? "Lưu thay đổi" : "Tạo");

  const secondaryLabel = mode === "edit" ? "Bỏ thay đổi" : "Bỏ";

  return (
    <div
      ref={barRef}
      className="sticky bottom-[calc(58px+env(safe-area-inset-bottom))] md:bottom-0 z-30 bg-surface-card border-t border-border py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
    >
      <div className="text-sm text-text-muted">
        {isDirty ? "Có thay đổi chưa lưu" : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:flex md:items-center md:justify-end md:ml-auto">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          className="w-full md:w-auto"
        >
          {secondaryLabel}
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          className="w-full md:w-auto"
        >
          {primaryLabel}
        </Button>
      </div>
    </div>
  );
}
