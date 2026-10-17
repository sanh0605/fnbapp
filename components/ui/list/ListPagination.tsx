import React from "react";
import Link from "next/link";
import { PageSlice, pageWindow } from "./paginate";

export interface ListPaginationProps {
  slice: Omit<PageSlice<unknown>, "rows">;
  unit: string;
  pageHref: (page: number) => string;
}

export function ListPagination({
  slice,
  unit,
  pageHref,
}: ListPaginationProps) {
  const { page, pageCount, firstIndex, lastIndex, total } = slice;
  const paginationPages = pageWindow(page, pageCount);

  return (
    <div className="bg-surface-card border-t border-border px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-sm text-text-muted">
        <span className="font-medium text-text-primary">{firstIndex}</span>–
        <span className="font-medium text-text-primary">{lastIndex}</span> trên{" "}
        <span className="font-medium text-text-primary">{total}</span> {unit}
      </div>

      {pageCount > 1 && (
        <nav aria-label="Phân trang" className="flex flex-wrap items-center justify-center gap-1">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="px-3 py-1 text-sm font-medium text-text-primary hover:bg-surface-secondary rounded border border-border min-h-[48px] md:min-h-[40px] min-w-[44px] flex items-center justify-center"
            >
              Trước
            </Link>
          ) : (
            <span className="px-3 py-1 text-sm font-medium text-text-muted/50 cursor-not-allowed min-h-[48px] md:min-h-[40px] min-w-[44px] flex items-center justify-center">
              Trước
            </span>
          )}

          <span className="md:hidden text-sm text-text-primary px-2 min-h-[48px] flex items-center">
            {page} / {pageCount}
          </span>

          {paginationPages.map((p) => (
            <Link
              key={p}
              href={pageHref(p)}
              aria-current={p === page ? "page" : undefined}
              className={`hidden md:flex min-h-[48px] md:min-h-[40px] min-w-[44px] items-center justify-center px-3 py-1 text-sm font-medium rounded border ${
                p === page
                  ? "bg-primary text-on-primary border-primary"
                  : "text-text-primary hover:bg-surface-secondary border-transparent hover:border-border"
              }`}
            >
              {p}
            </Link>
          ))}

          {page < pageCount ? (
            <Link
              href={pageHref(page + 1)}
              className="px-3 py-1 text-sm font-medium text-text-primary hover:bg-surface-secondary rounded border border-border min-h-[48px] md:min-h-[40px] min-w-[44px] flex items-center justify-center"
            >
              Sau
            </Link>
          ) : (
            <span className="px-3 py-1 text-sm font-medium text-text-muted/50 cursor-not-allowed min-h-[48px] md:min-h-[40px] min-w-[44px] flex items-center justify-center">
              Sau
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
