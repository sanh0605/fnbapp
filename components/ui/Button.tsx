import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded-button transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100";
  
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover active:bg-primary-active shadow-sm",
    secondary: "bg-surface-secondary text-text-primary hover:bg-border active:bg-gray-300",
    ghost: "bg-transparent text-primary hover:bg-primary-soft active:bg-primary-soft",
    danger: "bg-danger text-white hover:bg-danger active:bg-red-800 shadow-sm",
    warning: "bg-warning text-white hover:bg-warning/90 active:bg-warning/80 shadow-sm",
  };
  
  const sizes = {
    sm: "text-xs px-3 py-1.5 min-h-[32px]",
    md: "text-sm px-4 py-2 min-h-[44px]",
    lg: "text-base px-6 py-3 min-h-[48px]",
  };

  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`;

  return (
    <button className={classes} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
      {children}
    </button>
  );
}
