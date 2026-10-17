import React from "react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  STAFF: "Nhân viên",
  SYSTEM: "Hệ thống",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border border-border bg-surface-secondary text-text-secondary"
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
