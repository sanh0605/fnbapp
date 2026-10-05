import React from "react";
import Link from "next/link";

export interface DetailHeaderProps {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export function DetailHeader({
  backHref,
  backLabel,
  title,
  subtitle,
  badge,
  actions,
}: DetailHeaderProps): JSX.Element {
  return (
    <div className="space-y-3">
      <div>
        <Link
          href={backHref}
          className="text-sm font-medium text-primary hover:text-primary-hover no-underline inline-flex items-center gap-1 min-h-[44px]"
        >
          &larr; {backLabel}
        </Link>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && (
            <div className="text-sm text-text-secondary">{subtitle}</div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  );
}
