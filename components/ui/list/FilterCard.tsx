"use client";

import React, { useState } from "react";

export interface FilterCardProps {
  children: React.ReactNode;
  onApply: () => void;
  onClear: () => void;
  showClear: boolean;
  activeCount?: number;
  search?: React.ReactNode;
}

export function FilterCard({
  children,
  onApply,
  onClear,
  showClear,
  activeCount,
  search,
}: FilterCardProps) {
  const [open, setOpen] = useState(false);
  const hasChildren = React.Children.toArray(children).length > 0;
  const canFold = (search !== undefined || activeCount !== undefined) && hasChildren;

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

  const toggleLabel =
    activeCount && activeCount > 0 ? `Bộ lọc (${activeCount})` : "Bộ lọc";

  return (
    <div
      className="bg-surface-card rounded-2xl shadow-sm border border-border p-4 space-y-4"
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-wrap items-end gap-3">
        {(search !== undefined || canFold) && (
          <div
            className={
              search !== undefined
                ? "flex items-end gap-2 w-full"
                : "flex items-end gap-2 w-full md:hidden"
            }
          >
            {search !== undefined && <div className="flex-1 min-w-0">{search}</div>}
            {canFold && (
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpen((prev) => !prev)}
                className="md:hidden shrink-0 bg-surface-secondary text-text-primary px-4 rounded-lg font-medium hover:bg-surface-secondary/80 transition border border-border flex items-center justify-center min-h-[48px] md:min-h-[40px]"
              >
                {toggleLabel}
              </button>
            )}
          </div>
        )}
        <div className={canFold && !open ? "hidden md:contents" : "contents"}>
          {children}
          <div className="flex gap-2 w-full md:w-auto min-h-[48px] md:min-h-[40px]">
            <button
              type="button"
              onClick={onApply}
              className="flex-1 md:flex-none bg-surface-secondary text-text-primary px-4 rounded-lg font-medium hover:bg-surface-secondary/80 transition border border-border flex items-center justify-center min-w-[80px] min-h-[48px] md:min-h-[40px]"
            >
              Lọc
            </button>
            {showClear && (
              <button
                type="button"
                onClick={onClear}
                className="flex-1 md:flex-none text-danger px-4 rounded-lg font-medium hover:bg-danger/10 transition flex items-center justify-center min-w-[80px] min-h-[48px] md:min-h-[40px]"
              >
                Xoá lọc
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
