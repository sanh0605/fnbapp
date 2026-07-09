interface EmptyStateProps {
  icon?: string;          // emoji or short text
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
      {icon && <div className="text-5xl mb-3 opacity-30" aria-hidden="true">{icon}</div>}
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 mb-4">{description}</p>}
      {action && (
        action.href ? (
          <a href={action.href} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            {action.label}
          </a>
        ) : (
          <button type="button" onClick={action.onClick} className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
