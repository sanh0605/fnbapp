"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/shared/format";
import { useFilterForm } from "@/lib/shared/use-filter-form";
import { DayInput } from "@/components/ui/DayInput";
import type { IssueSlipListPage, IssueSlipKind } from "@/lib/stock/issue-slip-list";

interface IssueSlipsClientProps {
  pageData: IssueSlipListPage;
}

export default function IssueSlipsClient({ pageData }: IssueSlipsClientProps) {
  const searchParams = useSearchParams();
  
  const defaultFilters = { q: "", kind: "ALL", person: "ALL", from: "", to: "", page: "1" };
  const { draft, setField, applyFilters, isPending } = useFilterForm(defaultFilters);
  const [fromError, setFromError] = useState("");
  const [toError, setToError] = useState("");
  const [rangeMsg, setRangeMsg] = useState("");
  const [applyRequested, setApplyRequested] = useState(false);

  const hasAnyFilter = Boolean(searchParams.get("q") || searchParams.get("kind") || searchParams.get("person") || searchParams.get("from") || searchParams.get("to"));
  const draftChanged = draft.q !== defaultFilters.q || draft.kind !== defaultFilters.kind || draft.person !== defaultFilters.person || draft.from !== defaultFilters.from || draft.to !== defaultFilters.to;
  const showClear = hasAnyFilter || draftChanged;

  useEffect(() => {
    if (!applyRequested) return;
    setApplyRequested(false);
    handleApply();
  }, [applyRequested, draft]);

  function handleApply() {
    setFromError("");
    setToError("");
    setRangeMsg("");
    let hasError = false;
    if (draft.from === "invalid") {
      setFromError("Ngày không hợp lệ");
      hasError = true;
    }
    if (draft.to === "invalid") {
      setToError("Ngày không hợp lệ");
      hasError = true;
    }
    if (hasError) return;
    if (draft.from && draft.to && draft.from > draft.to) {
      setRangeMsg("Ngày bắt đầu phải trước ngày kết thúc");
      return;
    }
    applyFilters({ page: "1" });
  }

  function handleClear() {
    setFromError("");
    setToError("");
    setRangeMsg("");
    setField("q", "");
    setField("kind", "ALL");
    setField("person", "ALL");
    setField("from", "");
    setField("to", "");
    applyFilters({ q: "", kind: "ALL", person: "ALL", from: "", to: "", page: "1" });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      const target = e.target as HTMLElement;
      if (
        (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
        target.closest('.react-datepicker') === null
      ) {
        e.preventDefault();
        setApplyRequested(true);
      }
    }
  }

  function renderKindBadge(kind: IssueSlipKind, reason: string) {
    if (kind === "SLIP") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-surface-secondary text-text-secondary border border-border">
          {reason ? `Phiếu xuất · ${reason}` : "Phiếu xuất"}
        </span>
      );
    }
    if (kind === "STOCKTAKE") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-primary-soft text-primary border border-primary/30">
          Kiểm kê
        </span>
      );
    }
    if (kind === "CANCELLED") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-surface-secondary text-text-secondary border border-border">
          Đã huỷ
        </span>
      );
    }
    return null;
  }

  function getPageUrl(pageNum: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNum));
    return `?${params.toString()}`;
  }

  const { page, pageCount, firstIndex, lastIndex, total, rows, rangeError, people } = pageData;

  const paginationPages = useMemo(() => {
    let start = Math.max(1, page - 2);
    let end = Math.min(pageCount, start + 4);
    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }
    const pages = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [page, pageCount]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Kho</div>
          <h1 className="text-2xl font-bold text-text-primary">Phiếu xuất</h1>
        </div>
        <Link
          href="/admin/inventory/issue-slips/new"
          className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm w-full md:w-auto text-center min-h-[44px] flex items-center justify-center"
        >
          Tạo
        </Link>
      </div>

      <div className="bg-surface-card rounded-2xl shadow-sm border border-border p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3" onKeyDown={handleKeyDown}>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="search-input" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm kiếm</label>
            <input
              id="search-input"
              type="text"
              placeholder="Mã phiếu, tên mặt hàng"
              value={draft.q}
              onChange={(e) => setField("q", e.target.value)}
              className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
            />
          </div>
          <div className="w-full md:w-40">
            <label htmlFor="kind-select" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Loại</label>
            <select
              id="kind-select"
              value={draft.kind}
              onChange={(e) => setField("kind", e.target.value)}
              className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
            >
              <option value="ALL">Tất cả</option>
              <option value="SLIP">Phiếu xuất</option>
              <option value="STOCKTAKE">Kiểm kê</option>
              <option value="CANCELLED">Đã huỷ</option>
            </select>
          </div>
          <div className="w-full md:w-48">
            <label htmlFor="person-select" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Người ghi</label>
            <select
              id="person-select"
              value={draft.person}
              onChange={(e) => setField("person", e.target.value)}
              className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
            >
              <option value="ALL">Tất cả</option>
              {people.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-40">
            <DayInput
              label="Từ ngày"
              value={draft.from}
              onChange={(v) => { setField("from", v); setFromError(""); setRangeMsg(""); }}
              error={fromError}
            />
          </div>
          <div className="w-full md:w-40">
            <DayInput
              label="Đến ngày"
              value={draft.to}
              onChange={(v) => { setField("to", v); setToError(""); setRangeMsg(""); }}
              error={toError}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto min-h-[44px]">
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 md:flex-none bg-surface-secondary text-text-primary px-4 rounded-lg font-medium hover:bg-surface-secondary/80 transition border border-border flex items-center justify-center min-w-[80px] min-h-[44px]"
            >
              Lọc
            </button>
            {showClear && (
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 md:flex-none text-danger px-4 rounded-lg font-medium hover:bg-danger/10 transition flex items-center justify-center min-w-[80px] min-h-[44px]"
              >
                Xoá lọc
            </button>
            )}
          </div>
        </div>
      </div>

      {(rangeError || rangeMsg) && (
        <div className="bg-danger/10 text-danger px-4 py-3 rounded-lg text-sm font-medium">
          Ngày bắt đầu phải trước ngày kết thúc
        </div>
      )}

      {isPending && <div className="text-text-muted text-sm animate-pulse">Đang tải...</div>}

      <div className={`transition-opacity ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
        {rows.length === 0 ? (
          <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden p-8">
            <EmptyState
              icon={<span className="text-4xl">📦</span>}
              title={hasAnyFilter ? "Không có phiếu nào khớp bộ lọc" : "Chưa có phiếu xuất nào"}
              description={hasAnyFilter ? undefined : "Tạo phiếu xuất để ghi nhận hàng xuất khỏi kho."}
              action={hasAnyFilter ? { label: "Xoá lọc", onClick: handleClear } : undefined}
            />
          </div>
        ) : (
          <div className="bg-surface-card rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-surface-secondary text-text-secondary text-[11px] uppercase tracking-wider border-b border-border">
                    <th className="px-6 py-4 font-bold">Mã phiếu</th>
                    <th className="px-6 py-4 font-bold">Ngày xuất</th>
                    <th className="px-6 py-4 font-bold">Loại</th>
                    <th className="px-6 py-4 font-bold">Người ghi</th>
                    <th className="px-6 py-4 font-bold text-right">Giá trị</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-secondary/50 transition-colors group relative">
                      <td className="px-6 py-4">
                        <Link href={row.href} className="absolute inset-0 z-10 focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none">
                          <span className="sr-only">Xem chi tiết {row.id}</span>
                        </Link>
                        <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">{row.id}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums text-text-primary">
                        {row.dateText}
                      </td>
                      <td className="px-6 py-4 text-text-primary">
                        {renderKindBadge(row.kind, row.reason)}
                      </td>
                      <td className="px-6 py-4 text-text-primary">
                        {row.createdByName}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-text-primary">
                        {formatNumber(row.value)}đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {rows.map((row) => (
                <Link
                  key={row.id}
                  href={row.href}
                  className="block p-4 hover:bg-surface-secondary/50 transition-colors focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none min-h-[44px]"
                >
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <span className="font-mono text-[11px] text-text-muted font-bold">{row.id}</span>
                    <span className="font-bold text-text-primary text-base">{formatNumber(row.value)}đ</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <div className="text-xs text-text-muted">
                      {row.dateText} · {row.createdByName}
                    </div>
                    <div>
                      {renderKindBadge(row.kind, row.reason)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Footer */}
            <div className="bg-surface-secondary border-t border-border px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-text-muted">
                <span className="font-medium text-text-primary">{firstIndex}</span>–<span className="font-medium text-text-primary">{lastIndex}</span> trên <span className="font-medium text-text-primary">{total}</span> phiếu
              </div>
              
              {pageCount > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-1">
                  {page > 1 ? (
                    <Link
                      href={getPageUrl(page - 1)}
                      className="px-3 py-1 text-sm font-medium text-text-primary hover:bg-surface-card rounded border border-transparent hover:border-border min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      Trước
                    </Link>
                  ) : (
                    <span className="px-3 py-1 text-sm font-medium text-text-muted/50 cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center">Trước</span>
                  )}

                  {paginationPages.map(p => (
                    <Link
                      key={p}
                      href={getPageUrl(p)}
                      className={`min-h-[44px] min-w-[44px] items-center justify-center px-3 py-1 text-sm font-medium rounded border ${
                        p === page 
                          ? "flex bg-primary text-on-primary border-primary" 
                          : "hidden md:flex text-text-primary hover:bg-surface-card border-transparent hover:border-border"
                      }`}
                    >
                      {p}
                    </Link>
                  ))}

                  {page < pageCount ? (
                    <Link
                      href={getPageUrl(page + 1)}
                      className="px-3 py-1 text-sm font-medium text-text-primary hover:bg-surface-card rounded border border-transparent hover:border-border min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      Sau
                    </Link>
                  ) : (
                    <span className="px-3 py-1 text-sm font-medium text-text-muted/50 cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center">Sau</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
