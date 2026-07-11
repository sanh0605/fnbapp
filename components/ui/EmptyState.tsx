import { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon?: ReactNode;          // emoji or short text
  title: string;          // main message
  description?: string;   // helper text
  action?: {              // optional CTA button
    label: string;
    onClick?: () => void;
    href?: string;        // alternative to onClick
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 px-4 ${className || ""}`}>
      {icon && <div className="flex justify-center mb-4 text-text-muted">{icon}</div>}
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      {description && <p className="text-sm text-text-secondary mb-4">{description}</p>}
      {action && (
        action.href ? (
          <a href={action.href} className="inline-flex">
             <Button variant="primary">{action.label}</Button>
          </a>
        ) : (
          <Button variant="primary" onClick={action.onClick}>{action.label}</Button>
        )
      )}
    </div>
  );
}
