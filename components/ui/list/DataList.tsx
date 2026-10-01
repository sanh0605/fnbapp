"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { confirm } from "@/lib/shared/dialog";

export interface DataColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  align?: "right";
  secondary?: boolean;
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
  renderCard: (row: T) => React.ReactNode; // phone card body
  removal?: {
    // omitted -> no tick boxes, no bin
    verb: string; // "Xoá" or "Ngừng dùng"
    rowVerb?: (row: T) => string;
    confirmMessage: (count: number) => string;
    remove: (id: string) => Promise<RemoveResult>;
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
  renderCard,
  removal,
  empty,
}: DataListProps<T>): JSX.Element {
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

  const selectedCount = selectedIds.size;
  const allSelected =
    rows.length > 0 && rows.every((row) => selectedIds.has(getId(row)));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map(getId)));
    }
  }

  function toggleSelectRow(id: string) {
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
    const idsToDelete = rows.map(getId).filter((id) => selectedIds.has(id));
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

      {removal && selectedCount > 0 && (
        <div className="bg-primary-soft/50 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-medium text-text-primary">
            {deletingProgress
              ? `Đang ${removal.verb.toLowerCase()} ${deletingProgress.current}/${deletingProgress.total}…`
              : `Đã chọn ${selectedCount}`}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!!deletingProgress}
              onClick={handleRemoveSelected}
              className="bg-danger text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-danger/90 disabled:opacity-50 transition min-h-[44px] flex items-center justify-center shadow-sm"
            >
              {removal.verb} {selectedCount} dòng đã chọn
            </button>
            <button
              type="button"
              disabled={!!deletingProgress}
              onClick={() => setSelectedIds(new Set())}
              className="text-text-secondary hover:text-text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-surface-secondary transition min-h-[44px] flex items-center justify-center border border-border"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {removal && (
        <div className="md:hidden flex justify-end">
          <button
            type="button"
            onClick={() => {
              const next = !isMobileSelecting;
              setIsMobileSelecting(next);
              if (!next) {
                setSelectedIds(new Set());
              }
            }}
            className="text-sm font-medium text-primary hover:text-primary-hover px-3 py-1.5 rounded-lg border border-border hover:bg-surface-secondary transition min-h-[44px] flex items-center justify-center"
          >
            {isMobileSelecting ? "Xong" : "Chọn"}
          </button>
        </div>
      )}

      <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                {removal && (
                  <th className="px-4 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
                    />
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`px-6 py-4 font-bold text-[11px] ${
                      col.align === "right" ? "text-right" : ""
                    } ${col.secondary ? "hidden xl:table-cell" : ""}`}
                  >
                    {col.header}
                  </th>
                ))}
                {removal && (
                  <th className="px-4 py-4 w-16 text-center">
                    <span className="sr-only">{removal.verb}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => {
                const id = getId(row);
                const name = getName(row);
                const href = getHref(row);
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
                      <td className="px-4 py-4 text-center relative z-20">
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${name}`}
                          checked={isSelected}
                          onChange={() => toggleSelectRow(id)}
                          className="w-4 h-4 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col, idx) => (
                      <td
                        key={col.key}
                        className={`px-6 py-4 text-sm text-text-primary ${
                          col.align === "right" ? "text-right" : ""
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
                      <td className="px-4 py-4 text-center relative z-20">
                        <button
                          type="button"
                          title={verb}
                          aria-label={`${verb} ${name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSingle(row);
                          }}
                          className="p-2 text-text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors inline-flex items-center justify-center min-w-[36px] min-h-[36px]"
                        >
                          <TrashIcon />
                          <span className="sr-only">{verb}</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Phone Cards */}
        <div className="md:hidden flex flex-col divide-y divide-border">
          {rows.map((row) => {
            const id = getId(row);
            const name = getName(row);
            const href = getHref(row);
            const isSelected = selectedIds.has(id);
            const verb = removal?.rowVerb ? removal.rowVerb(row) : removal?.verb;

            return (
              <div
                key={id}
                className={`relative p-4 hover:bg-surface-secondary/50 transition-colors ${
                  isSelected ? "bg-primary-soft/30" : ""
                }`}
              >
                {removal && isMobileSelecting && (
                  <div className="relative z-20 mb-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      aria-label={`Chọn ${name}`}
                      checked={isSelected}
                      onChange={() => toggleSelectRow(id)}
                      className="w-5 h-5 rounded border-border text-primary focus:ring-focus-ring cursor-pointer"
                    />
                    <span className="text-sm font-medium text-text-primary">
                      Chọn {name}
                    </span>
                  </div>
                )}

                {isMobileSelecting ? (
                  <button
                    type="button"
                    onClick={() => toggleSelectRow(id)}
                    className="w-full text-left focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none min-h-[44px]"
                  >
                    {renderCard(row)}
                  </button>
                ) : (
                  <Link
                    href={href}
                    className={`block focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none min-h-[44px] ${
                      removal ? "pr-12" : ""
                    }`}
                  >
                    {renderCard(row)}
                  </Link>
                )}

                {removal && !isMobileSelecting && (
                  <div className="absolute top-2 right-2 z-20">
                    <button
                      type="button"
                      title={verb}
                      aria-label={`${verb} ${name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSingle(row);
                      }}
                      className="w-11 h-11 flex items-center justify-center text-text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
                    >
                      <TrashIcon />
                      <span className="sr-only">{verb}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
