"use client";

import React from "react";

export interface FilterCardProps {
  children: React.ReactNode;
  onApply: () => void;
  onClear: () => void;
  showClear: boolean;
}

export function FilterCard({
  children,
  onApply,
  onClear,
  showClear,
}: FilterCardProps): JSX.Element {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (
        (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
        target.closest(".react-datepicker") === null
      ) {
        e.preventDefault();
        onApply();
      }
    }
  }

  return (
    <div className="bg-surface-card rounded-2xl shadow-sm border border-border p-4 space-y-4">
      <div className="flex flex-wrap items-end gap-3" onKeyDown={handleKeyDown}>
        {children}
        <div className="flex gap-2 w-full md:w-auto min-h-[44px]">
          <button
            type="button"
            onClick={onApply}
            className="flex-1 md:flex-none bg-surface-secondary text-text-primary px-4 rounded-lg font-medium hover:bg-surface-secondary/80 transition border border-border flex items-center justify-center min-w-[80px] min-h-[44px]"
          >
            Lọc
          </button>
          {showClear && (
            <button
              type="button"
              onClick={onClear}
              className="flex-1 md:flex-none text-danger px-4 rounded-lg font-medium hover:bg-danger/10 transition flex items-center justify-center min-w-[80px] min-h-[44px]"
            >
              Xoá lọc
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
