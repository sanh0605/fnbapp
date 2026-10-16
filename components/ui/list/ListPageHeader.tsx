import React from "react";

export interface ListPageHeaderProps {
  group: string;
  title: string;
  action?: React.ReactNode;
}

export function ListPageHeader({ group, title, action }: ListPageHeaderProps) {
  return (
    <div className="flex flex-row items-center justify-between gap-4">
      <div>
        <div className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">
          {group}
        </div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
