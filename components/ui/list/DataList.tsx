"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirm } from "@/lib/shared/dialog";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PhoneRow, type PhoneRowData } from "./PhoneRow";
import type { SortDir } from "./sort";

export interface DataColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | null | undefined;
  align?: "right";
  secondary?: boolean;
  nowrap?: boolean;
}

export interface RemoveResult {
  error?: string;
  deactivated?: boolean;
}

export interface DataListProps<T> {
  rows: T[]; // the current page only
  getId: (row: T) => string;
  getName: (row: T) => string; // used in messages, e.g. "Vinamilk"
  getHref: (row: T) => string; // whole row / card opens this
  columns: DataColumn<T>[];
  phoneRow: (row: T) => PhoneRowData;
  sort?: {
    key: string;
    dir: SortDir;
    href: (key: string, dir: SortDir) => string;
  };
  removal?: {
    // omitted -> no tick boxes, no bin
    verb: string; // "Xoá" or "Ngừng dùng"
    rowVerb?: (row: T) => string;
    confirmMessage: (count: number) => string;
    remove: (id: string) => Promise<RemoveResult>;
    canRemove?: (row: T) => boolean; // omitted → every row is removable
  };
  totals?: {
    label: string;
    values: Record<string, React.ReactNode>;
  };
  empty: React.ReactNode;
}

function formatRemoveError(verb: string, name: string, error?: string): string {
  if (!error) {
    return `Không ${verb.toLowerCase()} được ${name}.`;
  }
  const verbLower = verb.toLowerCase();
  const prefixWithVerb = `Không ${verbLower} được ${name}`;
  const genericPrefix = `Không xoá được ${name}`;

  if (
    error.startsWith(prefixWithVerb) ||
    error.startsWith(genericPrefix) ||
    error.startsWith(name) ||
    error.includes(name)
  ) {
    return error;
  }
  return `Không ${verbLower} được ${name}: ${error}`;
}

function formatSuccessMessage(
  deletedCount: number,
  deactivatedCount: number,
  defaultVerb: string,
  // A list with a per-row verb mixes deletes and switch-offs, so its
  // list-wide verb ("Xoá hoặc ngừng dùng") cannot describe the outcome.
  perRowVerb: boolean
): string | null {
  if (deletedCount === 0 && deactivatedCount === 0) {
    return null;
  }
  if (deactivatedCount === 0 && !perRowVerb) {
    return `Đã ${defaultVerb.toLowerCase()} ${deletedCount} dòng.`;
  }
  const parts: string[] = [];
  if (deletedCount > 0) {
    parts.push(`Đã xoá ${deletedCount} dòng.`);
  }
  if (deactivatedCount > 0) {
    parts.push(`Đã ngừng dùng ${deactivatedCount} dòng.`);
  }
  return parts.join(" ");
}

function TrashIcon() {
  return (
    <svg
      className="w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function DataList<T>({
  rows,
  getId,
  getName,
  getHref,
  columns,
  phoneRow,
  sort,
  removal,
  totals,
  empty,
}: DataListProps<T>) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isMobileSelecting, setIsMobileSelecting] = useState(false);
  const [deletingProgress, setDeletingProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [statusResult, setStatusResult] = useState<{
    deletedCount: number;
    deactivatedCount: number;
    errors: string[];
  } | null>(null);

  const sortableColumns = columns.filter((col) => col.sortValue !== undefined);

  const isRowRemovable = (row: T) =>
    !removal?.canRemove || removal.canRemove(row);
  const removableRows = removal ? rows.filter(isRowRemovable) : [];
  const hasRemovableRows = removableRows.length > 0;

  const selectedCount = selectedIds.size;
  const allSelected =
    hasRemovableRows &&
    removableRows.every((row) => selectedIds.has(getId(row)));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(removableRows.map(getId)));
    }
  }

  function toggleSelectRow(id: string) {
    const row = rows.find((r) => getId(r) === id);
    if (row && !isRowRemovable(row)) {
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleRemoveSelected() {
    if (!removal) return;
    const idsToDelete = removableRows
      .map(getId)
      .filter((id) => selectedIds.has(id));
    if (idsToDelete.length === 0) return;

    const ok = await confirm({
      title: removal.verb,
      message: removal.confirmMessage(idsToDelete.length),
      variant: "danger",
    });
    if (!ok) return;

    let deletedCount = 0;
    let deactivatedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < idsToDelete.length; i++) {
      const id = idsToDelete[i];
      const row = rows.find((r) => getId(r) === id);
      const name = row ? getName(row) : id;

      setDeletingProgress({ current: i + 1, total: idsToDelete.length });
      const res = await removal.remove(id);
      if (res?.error) {
        errors.push(formatRemoveError(removal.verb, name, res.error));
      } else if (res?.deactivated) {
        deactivatedCount++;
      } else {
        deletedCount++;
      }
    }

    setDeletingProgress(null);
    setSelectedIds(new Set());
    setStatusResult({ deletedCount, deactivatedCount, errors });
    router.refresh();
  }

  async function handleRemoveSingle(row: T) {
    if (!removal) return;
    if (!isRowRemovable(row)) return;
    const id = getId(row);
    const name = getName(row);
    const verb = removal.rowVerb ? removal.rowVerb(row) : removal.verb;

    const ok = await confirm({
      title: verb,
      message: removal.confirmMessage(1),
      variant: "danger",
    });
    if (!ok) return;

    const res = await removal.remove(id);
    if (res?.error) {
      setStatusResult({
        deletedCount: 0,
        deactivatedCount: 0,
        errors: [formatRemoveError(verb, name, res.error)],
      });
    } else {
      const isDeactivated = Boolean(res?.deactivated);
      setStatusResult({
        deletedCount: isDeactivated ? 0 : 1,
        deactivatedCount: isDeactivated ? 1 : 0,
        errors: [],
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
    router.refresh();
  }

  const successMessage = statusResult
    ? formatSuccessMessage(
        statusResult.deletedCount,
        statusResult.deactivatedCount,
        removal?.verb ?? "xoá",
        Boolean(removal?.rowVerb)
      )
    : null;

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        {statusResult && (
          <div
            role="status"
            className="bg-surface-secondary border border-border rounded-xl p-4 text-sm space-y-1"
          >
            {successMessage && (
              <div className="text-text-primary font-medium">
                {successMessage}
              </div>
            )}
            {statusResult.errors.map((err, i) => (
              <div key={i} className="text-danger font-medium">
                {err}
              </div>
            ))}
          </div>
        )}
        <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden p-8">
          {empty}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:block md:space-y-4">
      {statusResult && (
        <div
          role="status"
          className="bg-surface-secondary border border-border rounded-xl p-4 text-sm space-y-1"
        >
          {successMessage && (
            <div className="text-text-primary font-medium">
              {successMessage}
            </div>
          )}
          {statusResult.errors.map((err, i) => (
            <div key={i} className="text-danger font-medium">
              {err}
            </div>
          ))}
        </div>
      )}

      {removal && selectedCount > 0 && (
        <div className="sticky bottom-[calc(58px+env(safe-area-inset-bottom))] md:static z-30 order-last md:order-none bg-primary-soft md:bg-primary-soft/50 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-medium text-text-primary">
            {deletingProgress
              ? `Đang ${removal.verb.toLowerCase()} ${deletingProgress.current}/${deletingProgress.total}…`
              : `Đã chọn ${selectedCount}`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="delete"
              disabled={!!deletingProgress}
              onClick={handleRemoveSelected}
            >
              {removal.verb} {selectedCount} dòng đã chọn
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!!deletingProgress}
              onClick={() => setSelectedIds(new Set())}
            >
              Bỏ chọn
            </Button>
          </div>
        </div>
      )}

      {(sort && sortableColumns.length > 0) || (removal && hasRemovableRows) ? (
        <div className="md:hidden flex items-center justify-between gap-3">
          {sort && sortableColumns.length > 0 ? (
            <div className="flex-1">
              <label htmlFor="sort-select" className="sr-only">
                Sắp xếp
              </label>
              <Select
                id="sort-select"
                aria-label="Sắp xếp"
                value={sort.href(sort.key, sort.dir)}
                onChange={(e) => router.replace(e.target.value)}
              >
                {sortableColumns.map((col) => (
                  <React.Fragment key={col.key}>
                    <option value={sort.href(col.key, "asc")}>
                      {col.header} tăng dần
                    </option>
                    <option value={sort.href(col.key, "desc")}>
                      {col.header} giảm dần
                    </option>
                  </React.Fragment>
                ))}
              </Select>
            </div>
          ) : <div />}
          {removal && hasRemovableRows && (
            <button
              type="button"
              onClick={() => {
                const next = !isMobileSelecting;
                setIsMobileSelecting(next);
                if (!next) {
                  setSelectedIds(new Set());
                }
              }}
              className="text-sm font-medium text-primary hover:text-primary-hover px-3 py-1.5 rounded-lg border border-border hover:bg-surface-secondary transition min-h-[48px] md:min-h-[40px] flex items-center justify-center shrink-0"
            >
              {isMobileSelecting ? "Xong" : "Chọn"}
            </button>
          )}
        </div>
      ) : null}

      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-page border-b border-border">
                {removal && (
                  <th className="px-4 py-3 w-12 text-center text-[13px] font-medium text-text-secondary">
                    {hasRemovableRows && (
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
                      />
                    )}
                  </th>
                )}
                {columns.map((col) => {
                  const isSortable = Boolean(sort && col.sortValue);
                  const isActive = Boolean(isSortable && sort && sort.key === col.key);
                  const nextDir: SortDir = isActive && sort?.dir === "asc" ? "desc" : "asc";
                  const ariaSort = isActive
                    ? sort?.dir === "asc"
                      ? "ascending"
                      : "descending"
                    : undefined;

                  return (
                    <th
                      key={col.key}
                      aria-sort={ariaSort}
                      className={`px-6 py-3 text-[13px] text-left font-semibold text-text-secondary ${
                        col.secondary ? "hidden xl:table-cell" : ""
                      }${col.nowrap ? " whitespace-nowrap" : ""}`}
                    >
                      {isSortable && sort ? (
                        <Link
                          href={sort.href(col.key, nextDir)}
                          className={`inline-flex items-center gap-1 hover:text-text-primary transition-colors ${
                            isActive ? "text-text-primary" : ""
                          }`}
                        >
                          <span>{col.header}</span>
                          {isActive && (
                            <span aria-hidden="true">
                              {sort.dir === "asc" ? "▲" : "▼"}
                            </span>
                          )}
                        </Link>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
                {removal && (
                  <th className="px-4 py-3 w-16 text-center text-[13px] font-medium text-text-secondary">
                    <span className="sr-only">{removal.verb}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {totals && (
                <tr className="bg-primary-soft">
                  {removal && <td className="px-4 py-3" />}
                  {columns.map((col) => {
                    const hasVal =
                      totals.values[col.key] !== undefined &&
                      totals.values[col.key] !== null;
                    const isFirstEmpty =
                      !hasVal &&
                      columns.find(
                        (c) =>
                          totals.values[c.key] === undefined ||
                          totals.values[c.key] === null
                      )?.key === col.key;
                    const content = hasVal
                      ? totals.values[col.key]
                      : isFirstEmpty
                      ? totals.label
                      : null;

                    return (
                      <td
                        key={col.key}
                        className={`px-6 py-3 text-sm font-normal text-text-primary ${
                          isFirstEmpty ? "whitespace-nowrap" : ""
                        } ${
                          col.align === "right" ? "text-right tabular-nums whitespace-nowrap" : ""
                        } ${col.secondary ? "hidden xl:table-cell" : ""}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                  {removal && <td className="px-4 py-3" />}
                </tr>
              )}
              {rows.map((row) => {
                const id = getId(row);
                const name = getName(row);
                const href = getHref(row);
                const isRemovable = isRowRemovable(row);
                const isSelected = selectedIds.has(id);
                const verb = removal?.rowVerb ? removal.rowVerb(row) : removal?.verb;

                return (
                  <tr
                    key={id}
                    className={`hover:bg-surface-secondary/50 transition-colors group relative ${
                      isSelected ? "bg-primary-soft/30" : ""
                    }`}
                  >
                    {removal && (
                      <td className="px-4 py-3 text-center relative z-20">
                        {isRemovable && (
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${name}`}
                            checked={isSelected}
                            onChange={() => toggleSelectRow(id)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
                          />
                        )}
                      </td>
                    )}
                    {columns.map((col, idx) => (
                      <td
                        key={col.key}
                        className={`px-6 py-3 text-sm font-normal text-text-primary ${
                          col.align === "right" ? "text-right tabular-nums" : ""
                        } ${col.secondary ? "hidden xl:table-cell" : ""}`}
                      >
                        {idx === 0 && (
                          <Link
                            href={href}
                            className="absolute inset-0 z-10 focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none"
                          >
                            <span className="sr-only">Xem chi tiết {name}</span>
                          </Link>
                        )}
                        {col.render(row)}
                      </td>
                    ))}
                    {removal && (
                      <td className="px-4 py-1.5 text-center relative z-20">
                        {isRemovable && (
                          <button
                            type="button"
                            title={verb}
                            aria-label={`${verb} ${name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSingle(row);
                            }}
                            className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors inline-flex items-center justify-center min-w-[32px] min-h-[32px]"
                          >
                            <TrashIcon />
                            <span className="sr-only">{verb}</span>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Phone Rows */}
        <div className="md:hidden flex flex-col divide-y divide-border">
          {totals && (() => {
            const totalCols = columns.filter(
              (col) =>
                totals.values[col.key] !== undefined &&
                totals.values[col.key] !== null
            );
            if (totalCols.length === 0) return null;
            return (
              <div className="px-4 py-2 bg-primary-soft text-sm text-text-primary tabular-nums">
                {totals.label}:{" "}
                {totalCols.length === 1
                  ? totals.values[totalCols[0].key]
                  : totalCols.map((col, i) => (
                      <React.Fragment key={col.key}>
                        {i > 0 && " · "}
                        {col.header} {totals.values[col.key]}
                      </React.Fragment>
                    ))}
              </div>
            );
          })()}
          {rows.map((row) => {
            const id = getId(row);
            const name = getName(row);
            const href = getHref(row);
            const isRemovable = isRowRemovable(row);
            const isSelected = selectedIds.has(id);
            const content = <PhoneRow {...phoneRow(row)} />;

            if (isMobileSelecting) {
              if (isRemovable) {
                return (
                  <label
                    key={id}
                    className={`px-4 py-2.5 min-h-[48px] flex items-center gap-3 cursor-pointer hover:bg-surface-secondary/50 transition-colors ${
                      isSelected ? "bg-primary-soft/30" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${name}`}
                      checked={isSelected}
                      onChange={() => toggleSelectRow(id)}
                      className="w-5 h-5 shrink-0 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">{content}</div>
                  </label>
                );
              }
              return (
                <div
                  key={id}
                  className="px-4 py-2.5 min-h-[48px]"
                >
                  {content}
                </div>
              );
            }

            return (
              <Link
                key={id}
                href={href}
                className="block px-4 py-2.5 min-h-[48px] hover:bg-surface-secondary/50 transition-colors focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none"
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
