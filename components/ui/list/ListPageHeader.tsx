import React from "react";

export interface ListPageHeaderProps {
  group: string;
  title: string;
  action?: React.ReactNode;
}

export function ListPageHeader({ group, title, action }: ListPageHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <div className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">
          {group}
        </div>
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
      </div>
      {action && <div className="w-full md:w-auto">{action}</div>}
    </div>
  );
}
