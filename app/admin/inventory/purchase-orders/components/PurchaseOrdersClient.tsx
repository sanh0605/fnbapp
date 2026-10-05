"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatNumber } from "@/lib/shared/format";
import { useFilterForm } from "@/lib/shared/use-filter-form";
import { DayInput } from "@/components/ui/DayInput";
import type { PurchaseOrderListPage } from "@/lib/purchasing/purchase-order-list";

interface PurchaseOrdersClientProps {
  pageData: PurchaseOrderListPage & { suppliers: { id: string; name: string }[] };
}

export default function PurchaseOrdersClient({ pageData }: PurchaseOrdersClientProps) {
  const searchParams = useSearchParams();
  
  const defaultFilters = { q: "", status: "ACTIVE", supplier: "ALL", from: "", to: "", page: "1", pay: "ALL" };
  const { draft, setField, applyFilters, isPending } = useFilterForm(defaultFilters);
  const [fromError, setFromError] = useState("");
  const [toError, setToError] = useState("");
  const [rangeMsg, setRangeMsg] = useState("");
  const [applyRequested, setApplyRequested] = useState(false);

  const hasAnyFilter = Boolean(searchParams.get("q") || searchParams.get("status") || searchParams.get("supplier") || searchParams.get("from") || searchParams.get("to") || searchParams.get("pay"));
  const draftChanged = draft.q !== defaultFilters.q || draft.status !== defaultFilters.status || draft.supplier !== defaultFilters.supplier || draft.from !== defaultFilters.from || draft.to !== defaultFilters.to || draft.pay !== defaultFilters.pay;
  const showClear = hasAnyFilter || draftChanged;

  useEffect(() => {
    if (!applyRequested) return;
    setApplyRequested(false);
    handleApply();
  }, [applyRequested, draft]); // Runs after the day box has committed its value

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
    setField("status", "ACTIVE");
    setField("supplier", "ALL");
    setField("from", "");
    setField("to", "");
    setField("pay", "ALL");
    applyFilters({ q: "", status: "ACTIVE", supplier: "ALL", from: "", to: "", page: "1", pay: "ALL" });
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

  function renderStatusBadge(status: string) {
    if (status === "COMPLETED") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-primary-soft text-primary border border-primary/30">
          Hoàn thành
        </span>
      );
    }
    if (status === "CANCELLED") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-surface-secondary text-text-muted border border-border">
          Đã huỷ
        </span>
      );
    }
    if (status === "DRAFT") {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-surface-secondary text-text-secondary border border-border">
          Nháp
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-surface-secondary text-text-secondary border border-border">
        {status}
      </span>
    );
  }

  function getPageUrl(pageNum: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNum));
    return `?${params.toString()}`;
  }

  const { page, pageCount, firstIndex, lastIndex, total, rows, rangeError } = pageData;

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
          <div className="text-sm font-bold text-text-muted uppercase tracking-wider mb-1">Nhập hàng</div>
          <h1 className="text-2xl font-bold text-text-primary">Phiếu nhập</h1>
        </div>
        <Link
          href="/admin/inventory/purchase-orders/new"
          className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition shadow-sm w-full md:w-auto text-center min-h-[44px] flex items-center justify-center"
        >
          Tạo phiếu nhập
        </Link>
      </div>

      <div className="bg-surface-card rounded-2xl shadow-sm border border-border p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-3" onKeyDown={handleKeyDown}>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="search-input" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tìm kiếm</label>
            <input
              id="search-input"
              type="text"
              placeholder="Tìm mã phiếu, nhà cung cấp, mặt hàng…"
              value={draft.q}
              onChange={(e) => setField("q", e.target.value)}
              className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
            />
          </div>
          <div className="w-full md:w-40">
            <label htmlFor="status-select" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Trạng thái</label>
            <select
              id="status-select"
              value={draft.status}
              onChange={(e) => setField("status", e.target.value)}
              className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
            >
              <option value="ACTIVE">Chưa huỷ</option>
              <option value="DRAFT">Nháp</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="CANCELLED">Đã huỷ</option>
              <option value="ALL">Tất cả</option>
            </select>
          </div>
          <div className="w-full md:w-40">
            <label htmlFor="pay-select" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Trả bằng</label>
            <select
              id="pay-select"
              value={draft.pay}
              onChange={(e) => setField("pay", e.target.value)}
              className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
            >
              <option value="ALL">Tất cả</option>
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </select>
          </div>
          <div className="w-full md:w-48">
            <label htmlFor="supplier-select" className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Nhà cung cấp</label>
            <select
              id="supplier-select"
              value={draft.supplier}
              onChange={(e) => setField("supplier", e.target.value)}
              className="w-full min-h-[44px] border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
            >
              <option value="ALL">Tất cả</option>
              {pageData.suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
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
              title={hasAnyFilter ? "Không có phiếu nào khớp bộ lọc" : "Chưa có phiếu nhập nào"}
              description={hasAnyFilter ? undefined : "Tạo phiếu nhập để thêm vào tồn kho."}
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
                    <th className="px-6 py-4 font-bold">Ngày nhập</th>
                    <th className="px-6 py-4 font-bold">Nhà cung cấp</th>
                    <th className="px-6 py-4 font-bold">Nguồn mua</th>
                    <th className="px-6 py-4 font-bold">Trạng thái</th>
                    <th className="px-6 py-4 font-bold">Trả bằng</th>
                    <th className="px-6 py-4 font-bold text-right">Tổng tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((po) => (
                    <tr key={po.id} className="hover:bg-surface-secondary/50 transition-colors group relative">
                      <td className="px-6 py-4">
                        <Link href={`/admin/inventory/purchase-orders/${po.id}`} title={po.supplierName} className="absolute inset-0 z-10 focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none">
                          <span className="sr-only">Xem chi tiết {po.id}</span>
                        </Link>
                        <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">{po.id}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap tabular-nums text-text-primary">
                        {po.dateText}
                      </td>
                      <td className="px-6 py-4 font-bold text-text-primary truncate max-w-[280px]" title={po.supplierName}>
                        {po.supplierName}
                      </td>
                      <td className="px-6 py-4 text-text-primary">
                        {po.sourceName}
                      </td>
                      <td className="px-6 py-4">
                        {renderStatusBadge(po.status)}
                      </td>
                      <td className="px-6 py-4 text-text-secondary whitespace-nowrap">
                        {po.paymentLabel}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-text-primary">
                        {formatNumber(po.totalAmount)}đ
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Phone Cards */}
            <div className="md:hidden flex flex-col divide-y divide-border">
              {rows.map((po) => (
                <Link
                  key={po.id}
                  href={`/admin/inventory/purchase-orders/${po.id}`}
                  className="block p-4 hover:bg-surface-secondary/50 transition-colors focus:ring-2 focus:ring-inset focus:ring-focus-ring outline-none min-h-[44px]"
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-mono text-[11px] text-text-muted font-bold">{po.id}</span>
                    <span className="font-bold text-text-primary text-base">{formatNumber(po.totalAmount)}đ</span>
                  </div>
                  <div className="font-bold text-text-primary line-clamp-2 mb-2 leading-tight">
                    {po.supplierName}
                  </div>
                  <div className="flex justify-between items-end gap-2">
                    <div className="text-xs text-text-muted">
                      {po.dateText} · {po.sourceName} · {po.paymentLabel}
                    </div>
                    <div>
                      {renderStatusBadge(po.status)}
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
