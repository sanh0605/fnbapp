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
  primary: "bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:bg-gray-100",
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
      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${variantStyles[variant]} ${className}`}
    >
      {loading ? loadingText : children}
    </button>
  );
}
