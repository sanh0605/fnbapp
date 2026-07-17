"use client";

import React from "react";

interface LoadingButtonProps {
  loading: boolean;
  loadingText?: string;
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "danger" | "secondary";
  form?: string;
  className?: string;
  disabled?: boolean;
}

const variantStyles: Record<string, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover disabled:bg-blue-400",
  danger: "bg-danger text-white hover:bg-danger disabled:bg-red-400",
  secondary: "bg-surface-secondary text-text-primary hover:bg-border disabled:bg-surface-secondary",
};

export function LoadingButton({
  loading,
  loadingText = "Đang xử lý…",
  children,
  onClick,
  type = "button",
  variant = "primary",
  form,
  className = "",
  disabled = false,
}: LoadingButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      form={form}
      disabled={loading || disabled}
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:outline-none ${variantStyles[variant]} ${className}`}
    >
      {loading ? loadingText : children}
    </button>
  );
}
