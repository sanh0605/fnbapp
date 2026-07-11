import React from 'react';

export function Card({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-surface-card rounded-card border border-border shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
  );
}
