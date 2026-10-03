import React from "react";

export function RoleBadge({ role }: { role: string }): JSX.Element {
  const colorClass =
    role === "ADMIN"
      ? "bg-danger/10 text-danger-active border-danger/20"
      : role === "MANAGER"
      ? "bg-warning/10 text-warning-active border-warning/20"
      : "bg-primary-soft text-primary-active border-primary/20";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${colorClass}`}
    >
      {role}
    </span>
  );
}
