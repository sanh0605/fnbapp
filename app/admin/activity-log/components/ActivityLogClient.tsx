"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ActivityLogEvent as OrderEvent } from "../actions";

interface ActivityLogClientProps {
  initialEvents: OrderEvent[];
  actors: string[];
  totalCount: number;
  itemsPerPage: number;
}

export default function ActivityLogClient({
  initialEvents,
  actors,
  totalCount,
  itemsPerPage,
}: ActivityLogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [eventType, setEventType] = useState(() => searchParams.get("type") || "ALL");
  const [actorFilter, setActorFilter] = useState(() => searchParams.get("actor") || "ALL");
  const [startDate, setStartDate] = useState(() => searchParams.get("from") || "");
  const [endDate, setEndDate] = useState(() => searchParams.get("to") || "");
  const [currentPage, setCurrentPage] = useState(() => {
    const page = Number(searchParams.get("page"));
    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  });

  useEffect(() => {
    setSearch(searchParams.get("q") || "");
    setEventType(searchParams.get("type") || "ALL");
    setActorFilter(searchParams.get("actor") || "ALL");
    setStartDate(searchParams.get("from") || "");
    setEndDate(searchParams.get("to") || "");
    const page = Number(searchParams.get("page"));
    setCurrentPage(Number.isFinite(page) && page > 0 ? Math.floor(page) : 1);
  }, [searchParams]);

  const updateUrl = (updates: {
    page?: number;
    q?: string;
    type?: string;
    actor?: string;
    from?: string;
    to?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["q", "type", "actor", "from", "to"] as const) {
      const value = updates[key];
      if (value === undefined) continue;
      if (value && value !== "ALL") params.set(key, value);
      else params.delete(key);
    }

    const isFilterChange = ["q", "type", "actor", "from", "to"]
      .some(key => updates[key as keyof typeof updates] !== undefined);
    const targetPage = updates.page ?? (isFilterChange ? 1 : currentPage);
    if (targetPage > 1) params.set("page", String(targetPage));
    else params.delete("page");
    setCurrentPage(targetPage);

    const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => {
      if (updates.q !== undefined) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const renderDelta = (deltaJson?: string) => {
    if (!deltaJson) return null;
    try {
      const delta = JSON.parse(deltaJson);
      if (typeof delta !== "object" || delta === null) return null;

      const items = Object.entries(delta).map(([key, val]) => {
        let label = key;
        let formattedVal = String(val);

        if (key === "gross_total") {
          label = "Doanh thu gốc";
          formattedVal = formatNumber(Number(val));
        } else if (key === "net_total") {
          label = "Doanh thu thuần";
          formattedVal = formatNumber(Number(val));
        } else if (key === "line_count") {
          label = "Số món";
        } else if (key === "payment_method") {
          label = "PT Thanh toán";
          formattedVal = val === "BANK_TRANSFER" ? "Chuyển khoản" : "Tiền mặt";
        }

        return (
          <span
            key={key}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-surface-secondary text-text-secondary border border-border"
          >
            <span className="text-[10px] uppercase font-bold text-text-muted">{label}:</span>
            <span>{formattedVal}</span>
          </span>
        );
      });

      return <div className="flex flex-wrap gap-2 mt-2">{items}</div>;
    } catch (e) {
      return (
        <pre className="text-[10px] text-text-muted font-mono bg-surface-secondary p-2 rounded-lg border border-border mt-2 overflow-x-auto">
          {deltaJson}
        </pre>
      );
    }
  };

  const getEventBadge = (type: string) => {
    switch (type) {
      case "CREATED":
        return {
          label: "Tạo mới",
          classes: "bg-success/10 text-success-active border-success/30",
          dotColor: "bg-success ring-success/20",
        };
      case "EDITED":
        return {
          label: "Chỉnh sửa",
          classes: "bg-primary-soft text-primary-active border-primary/20",
          dotColor: "bg-primary ring-primary/20",
        };
      case "VOIDED":
        return {
          label: "Hủy đơn",
          classes: "bg-danger/10 text-danger-active border-danger/30",
          dotColor: "bg-danger ring-danger/20",
        };
      case "REOPENED":
        return {
          label: "Mở lại",
          classes: "bg-warning/10 text-warning-active border-warning/30",
          dotColor: "bg-warning ring-warning/20",
        };
      case "MIGRATED":
        return {
          label: "Di trú",
          classes: "bg-surface-secondary text-text-secondary border-border",
          dotColor: "bg-border ring-border",
        };
      default:
        return {
          label: type,
          classes: "bg-page text-text-primary border-border",
          dotColor: "bg-text-muted ring-border",
        };
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nhật ký Hoạt động"
        subtitle="Theo dõi lịch sử chỉnh sửa đơn hàng, hủy đơn, và các sự kiện trong hệ thống."
      />
      <div className="flex flex-wrap items-end gap-3 mb-6">

        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Tìm kiếm
          </label>
          <input
            type="text"
            placeholder="Tìm mã đơn, người tạo, lý do..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateUrl({ q: search });
            }}
            className="w-full md:w-56 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => updateUrl({ q: search })}
          disabled={isPending}
          className="min-h-[44px] rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          Lọc
        </button>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Loại Sự Kiện
          </label>
          <select
            value={eventType}
            onChange={(e) => {
              setEventType(e.target.value);
              updateUrl({ type: e.target.value });
            }}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
          >
            <option value="ALL">Tất cả</option>
            <option value="CREATED">Tạo mới (CREATED)</option>
            <option value="EDITED">Chỉnh sửa (EDITED)</option>
            <option value="VOIDED">Hủy đơn (VOIDED)</option>
            <option value="REOPENED">Mở lại (REOPENED)</option>
            <option value="MIGRATED">Di trú (MIGRATED)</option>
          </select>
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Tài Khoản
          </label>
          <select
            value={actorFilter}
            onChange={(e) => {
              setActorFilter(e.target.value);
              updateUrl({ actor: e.target.value });
            }}
            className="w-full md:w-40 border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring bg-surface-card shadow-sm"
          >
            <option value="ALL">Tất cả tài khoản</option>
            {actors.map((actor) => (
              <option key={actor} value={actor}>
                {actor}
              </option>
            ))}
          </select>
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Từ ngày
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              updateUrl({ from: e.target.value });
            }}
            className="w-full md:w-auto border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Đến ngày
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              updateUrl({ to: e.target.value });
            }}
            className="w-full md:w-auto border border-border rounded-lg px-3 py-2 min-h-[44px] text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card shadow-sm"
          />
        </div>
      
      </div>

      <div className={`relative pl-6 md:pl-10 ${isPending ? "opacity-60" : ""}`}>
        {/* Vertical Timeline Line */}
        <div className="absolute top-4 bottom-4 left-[34px] md:left-[50px] w-0.5 border-border" />

        <div className="space-y-6">
          {initialEvents.length === 0 ? (
            <EmptyState 
              icon="🕒" 
              title="Chưa có nhật ký hoạt động" 
              description="Hệ thống sẽ ghi nhận lịch sử các thao tác thay đổi ở đây."
            />
          ) : (
            initialEvents.map((evt) => {
              const badge = getEventBadge(evt.event_type);
              return (
                <div key={evt.id} className="relative group">
                  {/* Timeline Dot Indicator */}
                  <div
                    className={`absolute -left-[27px] md:-left-[43px] top-4 w-4 h-4 rounded-full border-4 border-white ${badge.dotColor} ring-4 transition-transform duration-200 group-hover:scale-125 z-10`}
                  />

                  {/* Card Container */}
                  <div className="bg-surface-card rounded-2xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${badge.classes}`}
                        >
                          {badge.label}
                        </span>
                        <span className="font-extrabold text-sm text-text-primary">
                          Đơn hàng {evt.order_no}
                        </span>
                        <span className="text-[11px] text-text-muted font-medium">
                          ({evt.id})
                        </span>
                      </div>

                      <div className="text-xs text-text-secondary space-y-1">
                        <p className="flex items-center gap-1.5">
                          <span className="text-text-muted">Thời gian:</span>
                          <span className="font-medium text-text-secondary">
                            {formatDateTime(evt.event_at)}
                          </span>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <span className="text-text-muted">Thực hiện:</span>
                          <span className="font-bold text-text-primary">
                            {evt.actor_name}
                          </span>
                        </p>
                        {evt.from_version !== undefined && evt.to_version !== undefined && (
                          <p className="flex items-center gap-1.5">
                            <span className="text-text-muted">Phiên bản:</span>
                            <span className="font-mono bg-surface-secondary border border-border rounded px-1 text-[10px]">
                              v{evt.from_version || 0} ➔ v{evt.to_version}
                            </span>
                          </p>
                        )}
                        {evt.reason && (
                          <p className="mt-1 pt-1 border-t border-border">
                            <span className="text-text-muted">Lý do:</span>{" "}
                            <span className="font-medium text-text-primary italic">
                              "{evt.reason}"
                            </span>
                          </p>
                        )}
                      </div>

                      {renderDelta(evt.delta_json)}
                    </div>

                    <div className="shrink-0 flex items-center md:self-stretch justify-end">
                      <span className="text-[11px] text-text-muted font-medium bg-surface-secondary border border-border rounded px-2.5 py-1">
                        Mã đơn: {evt.order_id}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-xs font-semibold text-text-muted">
          {initialEvents.length} / {totalCount} sự kiện
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1 || isPending}
            onClick={() => updateUrl({ page: currentPage - 1 })}
            className="min-h-[40px] rounded-lg border border-border bg-surface-card px-4 text-sm font-bold text-text-secondary disabled:opacity-40"
          >
            Trước
          </button>
          <span className="min-w-20 text-center text-xs font-bold text-text-secondary">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={currentPage >= totalPages || isPending}
            onClick={() => updateUrl({ page: currentPage + 1 })}
            className="min-h-[40px] rounded-lg border border-border bg-surface-card px-4 text-sm font-bold text-text-secondary disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}
