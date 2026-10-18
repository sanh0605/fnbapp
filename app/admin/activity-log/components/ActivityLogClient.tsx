"use client";

import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { DateRangeButton } from "@/components/ui/DateRangeButton";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { useEffect, useState, useMemo, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  formatRangeButtonText,
  writeRangeParams,
  type RangeValue,
} from "@/lib/shared/date-range-params";
import type { ActivityLogEvent as OrderEvent } from "../actions";

function formatEmptyRangePart(range: RangeValue): string {
  const text = formatRangeButtonText(range);
  const [preset, ...rest] = text.split(" · ");
  return `${preset} (${rest.join(" · ")})`;
}

function parseDelta(deltaJson?: string): {
  netTotal?: number;
  items: { key: string; label: string; value: string }[];
} {
  if (!deltaJson) return { items: [] };
  try {
    const delta = JSON.parse(deltaJson);
    if (typeof delta !== "object" || delta === null) return { items: [] };

    let netTotal: number | undefined;
    const items: { key: string; label: string; value: string }[] = [];

    for (const [key, val] of Object.entries(delta)) {
      let label = key;
      let formattedVal = String(val);

      if (key === "gross_total") {
        label = "Doanh thu gốc";
        formattedVal = formatNumber(Number(val));
      } else if (key === "net_total") {
        label = "Doanh thu thuần";
        netTotal = Number(val);
        formattedVal = formatNumber(Number(val));
      } else if (key === "line_count") {
        label = "Số món";
      } else if (key === "payment_method") {
        label = "PT thanh toán";
        formattedVal = val === "BANK_TRANSFER" ? "Chuyển khoản" : "Tiền mặt";
      }

      items.push({ key, label, value: formattedVal });
    }

    return { netTotal, items };
  } catch {
    return { items: [{ key: "raw", label: "", value: deltaJson }] };
  }
}

function eventBadge(type: string) {
  let label = type;
  let classes = "bg-page text-text-primary border-border";
  switch (type) {
    case "CREATED":
      label = "Tạo mới";
      classes = "bg-success/10 text-success-active border-success/30";
      break;
    case "EDITED":
      label = "Chỉnh sửa";
      classes = "bg-primary-soft text-primary-active border-primary/20";
      break;
    case "VOIDED":
      label = "Huỷ đơn";
      classes = "bg-danger/10 text-danger-active border-danger/30";
      break;
    case "REOPENED":
      label = "Mở lại";
      classes = "bg-warning/10 text-warning-active border-warning/30";
      break;
    case "MIGRATED":
      label = "Di trú";
      classes = "bg-surface-secondary text-text-secondary border-border";
      break;
  }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${classes}`}
    >
      {label}
    </span>
  );
}

export interface ActivityLogClientProps {
  initialEvents: OrderEvent[];
  actors: string[];
  actorLabel: string | null;
  totalCount: number;
  itemsPerPage: number;
  range: RangeValue;
  today: string;
  searching?: boolean;
}

export default function ActivityLogClient({
  initialEvents,
  actors,
  actorLabel,
  totalCount,
  itemsPerPage,
  range,
  today,
  searching = false,
}: ActivityLogClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(() => searchParams.get("q") || "");
  const [eventType, setEventType] = useState(() => searchParams.get("type") || "ALL");
  const actorFromUrl = actorLabel ?? (searchParams.get("actor") || "ALL");
  const [actorFilter, setActorFilter] = useState(actorFromUrl);
  const [currentPage, setCurrentPage] = useState(() => {
    const page = Number(searchParams.get("page"));
    return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  });

  useEffect(() => {
    setSearch(searchParams.get("q") || "");
    setEventType(searchParams.get("type") || "ALL");
    setActorFilter(actorFromUrl);
    const page = Number(searchParams.get("page"));
    setCurrentPage(Number.isFinite(page) && page > 0 ? Math.floor(page) : 1);
  }, [searchParams, actorFromUrl]);

  const updateUrl = (updates: {
    q?: string;
    type?: string;
    actor?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["q", "type", "actor"] as const) {
      const value = updates[key];
      if (value === undefined) continue;
      if (value && value !== "ALL") params.set(key, value);
      else params.delete(key);
    }

    // Every caller changes a filter, so the list goes back to page 1.
    params.delete("page");
    setCurrentPage(1);

    const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => {
      if (updates.q !== undefined) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    });
  };

  const handleDateRangeChange = (nextRange: RangeValue) => {
    const params = new URLSearchParams(searchParams.toString());
    writeRangeParams(params, nextRange);
    params.delete("page");
    setCurrentPage(1);
    const href = params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  };

  const handleClear = () => {
    setSearch("");
    setEventType("ALL");
    setActorFilter("ALL");
    setCurrentPage(1);
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  };

  const hasAnyFilter = Boolean(
    search ||
      (eventType && eventType !== "ALL") ||
      (actorFilter && actorFilter !== "ALL") ||
      searchParams.get("q") ||
      (searchParams.get("type") && searchParams.get("type") !== "ALL") ||
      (searchParams.get("actor") && searchParams.get("actor") !== "ALL") ||
      (searchParams.get("range") && searchParams.get("range") !== "THIS_MONTH") ||
      searchParams.get("from") ||
      searchParams.get("to")
  );

  const isDateNotDefault = range.preset !== "THIS_MONTH";

  const activeCount =
    (searchParams.get("q")?.trim() ? 1 : 0) +
    (eventType !== "ALL" ? 1 : 0) +
    (actorFilter !== "ALL" ? 1 : 0) +
    (isDateNotDefault ? 1 : 0);

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));

  const columns: DataColumn<OrderEvent>[] = useMemo(
    () => [
      {
        key: "event_at",
        header: "Thời gian",
        nowrap: true,
        render: (evt) => (
          <span className="whitespace-nowrap text-text-secondary">
            {formatDateTimeFull(evt.event_at)}
          </span>
        ),
      },
      {
        key: "event_type",
        header: "Sự kiện",
        render: (evt) => eventBadge(evt.event_type),
      },
      {
        key: "order_no",
        header: "Đơn hàng",
        nowrap: true,
        render: (evt) => (
          <span className="font-mono text-xs text-primary whitespace-nowrap">
            {evt.order_no}
          </span>
        ),
      },
      {
        key: "actor_name",
        header: "Người làm",
        render: (evt) => evt.actor_name,
      },
      {
        key: "reason",
        header: "Lý do",
        render: (evt) => {
          if (!evt.reason) return <span className="text-text-muted">—</span>;
          const text = evt.reason === "POS checkout" ? "Bán tại máy bán hàng" : evt.reason;
          return <span className="text-text-secondary">{text}</span>;
        },
      },
      {
        key: "delta",
        header: "Thay đổi",
        render: (evt) => {
          const { items } = parseDelta(evt.delta_json);
          if (items.length === 0) return <span className="text-text-muted">—</span>;
          return (
            <span className="text-text-secondary">
              {items.map((it) => `${it.label} ${it.value}`.trim()).join(" · ")}
            </span>
          );
        },
      },
    ],
    [],
  );

  const firstIndex = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const lastIndex = Math.min(totalCount, currentPage * itemsPerPage);
  const slice = {
    page: currentPage,
    pageCount: totalPages,
    total: totalCount,
    firstIndex,
    lastIndex,
  };

  const pageHref = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 1) params.set("page", String(p));
    else params.delete("page");
    return params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <ListPageHeader
          group="Cài đặt"
          title="Nhật ký hoạt động"
        />
        <p className="text-sm text-text-secondary">
          Theo dõi lịch sử chỉnh sửa đơn hàng, huỷ đơn, và các sự kiện trong hệ thống.
        </p>
      </div>

      <FilterCard
        onApply={() => updateUrl({ q: search })}
        onClear={handleClear}
        showClear={hasAnyFilter}
        activeCount={activeCount}
        search={
          <div className="shrink-0 w-full md:w-56">
            <Field label="Tìm kiếm" htmlFor="filter-search">
              <TextInput
                id="filter-search"
                placeholder="Ví dụ: 261017001032"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
        }
      >
        <div className="w-full md:w-auto shrink-0">
          <DateRangeButton
            value={range}
            today={today}
            onChange={handleDateRangeChange}
            disabled={searching}
            disabledHint="Đang tìm trên mọi ngày · xoá ô tìm để lọc theo ngày"
          />
        </div>
        <div className="shrink-0 w-full md:w-40">
          <Field label="Loại sự kiện" htmlFor="filter-event-type">
            <Select
              id="filter-event-type"
              value={eventType}
              onChange={(e) => {
                setEventType(e.target.value);
                updateUrl({ type: e.target.value });
              }}
            >
              <option value="ALL">Tất cả</option>
              <option value="CREATED">Tạo mới</option>
              <option value="EDITED">Chỉnh sửa</option>
              <option value="VOIDED">Huỷ đơn</option>
              <option value="REOPENED">Mở lại</option>
              <option value="MIGRATED">Di trú</option>
            </Select>
          </Field>
        </div>
        <div className="shrink-0 w-full md:w-40">
          <Field label="Tài khoản" htmlFor="filter-actor">
            <Select
              id="filter-actor"
              value={actorFilter}
              onChange={(e) => {
                setActorFilter(e.target.value);
                updateUrl({ actor: e.target.value });
              }}
            >
              <option value="ALL">Tất cả tài khoản</option>
              {actorFilter !== "ALL" && !actors.includes(actorFilter) && (
                <option value={actorFilter}>{actorFilter}</option>
              )}
              {actors.map((actor) => (
                <option key={actor} value={actor}>
                  {actor}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FilterCard>

      <div className={isPending ? "opacity-60 transition-opacity" : ""}>
        <DataList
          rows={initialEvents}
          getId={(evt) => evt.id}
          getName={(evt) => `Đơn hàng ${evt.order_no}`}
          getHref={(evt) =>
            `/admin/orders/${encodeURIComponent(evt.order_id)}`
          }
          columns={columns}
          phoneRow={(evt) => {
            const { netTotal } = parseDelta(evt.delta_json);
            const time = formatDateTimeFull(evt.event_at);
            const person = evt.actor_name;
            const reason = evt.reason && evt.reason !== "POS checkout" ? evt.reason : null;

            const meta = [time, person, reason]
              .filter(Boolean)
              .join(" · ");

            return {
              title: `Đơn hàng ${evt.order_no}`,
              value: netTotal !== undefined ? `${formatNumber(netTotal)}đ` : undefined,
              badge: eventBadge(evt.event_type),
              meta,
            };
          }}
          empty={
            <EmptyState 
              icon="🕒" 
              title={
                searching
                  ? "Không tìm thấy nhật ký nào trên mọi ngày"
                  : `Không có nhật ký nào trong ${formatEmptyRangePart(range)}`
              }
              description={
                searching || hasAnyFilter
                  ? undefined
                  : "Hệ thống sẽ ghi nhận lịch sử các thao tác thay đổi ở đây."
              }
              action={{
                label: "Xoá lọc",
                onClick: handleClear,
              }}
            />
          }
        />
      </div>

      {totalCount > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="sự kiện"
            pageHref={pageHref}
          />
        </div>
      )}
    </div>
  );
}
