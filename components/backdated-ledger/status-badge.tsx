import React from "react";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: "Chờ duyệt", className: "bg-amber-50 text-amber-700 border-amber-200" },
  APPROVED: { label: "Đã duyệt", className: "bg-blue-50 text-blue-700 border-blue-200" },
  RECOMPUTED: { label: "Đã tính lại", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  REJECTED: { label: "Đã từ chối", className: "bg-page text-text-primary border-border" },
};

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  const config = STATUS_CONFIG[status] || { label: status, className: "bg-page text-text-primary border-border" };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-70"></span>
      {config.label}
    </span>
  );
}
