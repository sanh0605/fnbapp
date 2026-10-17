interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;  // buttons/links on the right
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div className="shrink-0 max-w-full">
        <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
        {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
