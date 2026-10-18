import React from "react";

export interface ListPageHeaderProps {
  group: string;
  title: string;
  action?: React.ReactNode;
}

export function ListPageHeader({ group, title, action }: ListPageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div
        className={
          action
            ? "shrink-0 max-w-[calc(100%-5rem)] md:max-w-full"
            : "shrink-0 max-w-full"
        }
      >
        {group && (
          <div className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">
            {group}
          </div>
        )}
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
