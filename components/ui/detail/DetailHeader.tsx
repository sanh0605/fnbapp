import React from "react";
import { BackLink } from "@/components/ui/BackLink";

export interface DetailHeaderProps {
  backHref: string;
  backLabel: string;
  title: React.ReactNode;
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
}: DetailHeaderProps) {
  return (
    <div className="space-y-3">
      <div>
        <BackLink
          href={backHref}
          label={backLabel}
        />
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
