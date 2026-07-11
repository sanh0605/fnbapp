import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

interface AlertProps {
  variant?: 'success' | 'warning' | 'danger' | 'info';
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', title, children, className = '' }: AlertProps) {
  const styles = {
    success: { wrapper: "bg-green-50 border-green-200 text-success", icon: <CheckCircle2 className="w-5 h-5 text-success" /> },
    warning: { wrapper: "bg-orange-50 border-orange-200 text-warning", icon: <AlertTriangle className="w-5 h-5 text-warning" /> },
    danger: { wrapper: "bg-red-50 border-red-200 text-danger", icon: <XCircle className="w-5 h-5 text-danger" /> },
    info: { wrapper: "bg-primary-soft border-blue-200 text-primary", icon: <Info className="w-5 h-5 text-primary" /> },
  };

  const current = styles[variant];

  return (
    <div className={`flex gap-3 p-4 border rounded-card ${current.wrapper} ${className}`}>
      <div className="shrink-0 mt-0.5">{current.icon}</div>
      <div>
        {title && <h4 className="font-semibold mb-1">{title}</h4>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
    </div>
  );
}
