import React from 'react';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'danger' | 'processing' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  const variants = {
    success: "bg-green-100 text-success border border-green-200",
    warning: "bg-orange-100 text-warning border border-orange-200",
    danger: "bg-red-100 text-danger border border-red-200",
    processing: "bg-purple-100 text-processing border border-purple-200",
    neutral: "bg-surface-secondary text-text-secondary border border-border",
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
