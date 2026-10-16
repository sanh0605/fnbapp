"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { DateRangeButton } from "@/components/ui/DateRangeButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import {
  formatRangeButtonText,
  writeRangeParams,
  type RangeValue,
} from "@/lib/shared/date-range-params";

import type { OrderListItem } from "./actions";

function formatEmptyRangePart(range: RangeValue): string {
  const text = formatRangeButtonText(range);
  const [preset, ...rest] = text.split(" · ");
  return `${preset} (${rest.join(" · ")})`;
}

type OrderLine = OrderListItem["lines"][0];
type Order = OrderListItem;

function renderPaymentMethodBadge(order: Order) {
  const payments = order.payments ?? [];
  if (payments.length >= 2) {
    const labels: string[] = [];
    for (const p of payments) {
      const label = p.method === "BANK_TRANSFER" ? "Chuyển khoản" : "Tiền mặt";
      if (!labels.includes(label)) labels.push(label);
    }
    return <Badge variant="neutral">{labels.join(" + ")}</Badge>;
  }

  return order.method === "Chuyen khoan" ? (
    <Badge variant="neutral">Chuyển khoản</Badge>
  ) : (
    <Badge variant="success">Tiền mặt</Badge>
  );
}

interface Brand {
  id: string;
  name: string;
}

export interface OrderTableProps {
  initialOrders: Order[];
  totalCount: number;
  totals?: { count: number; netTotal: number };
  itemsPerPage: number;
  brands: Brand[];
  range: RangeValue;
  today: string;
  searching?: boolean;
}

export default function OrderTable({
  initialOrders,
  totalCount,
  totals,
  itemsPerPage,
  brands,
  range,
  today,
  searching = false,
}: OrderTableProps) {
  const [orders, setOrders] = useState(initialOrders);
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [isPendingFilter, startFilterTransition] = useTransition();

  const [currentPage, setCurrentPage] = useState<number>(() => {
    const val = searchParams.get("page");
    return val ? parseInt(val, 10) || 1 : 1;
  });

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    return searchParams.get("q") || "";
  });
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    return searchParams.get("status") || "";
  });
  const [paymentFilter, setPaymentFilter] = useState<string>(() => {
    return searchParams.get("payment") || "";
  });
  const [brandFilter, setBrandFilter] = useState<string>(() => {
    return searchParams.get("brand") || "";
  });

  const currentUrl = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;
  const returnTo = encodeURIComponent(currentUrl);

  // Sync URL changes back to local states (handles back/forward navigation)
  useEffect(() => {
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const payment = searchParams.get("payment") || "";
    const brand = searchParams.get("brand") || "";
    const pageVal = searchParams.get("page");
    const page = pageVal ? parseInt(pageVal, 10) || 1 : 1;

    if (q !== searchQuery) setSearchQuery(q);
    if (status !== statusFilter) setStatusFilter(status);
    if (payment !== paymentFilter) setPaymentFilter(payment);
    if (brand !== brandFilter) setBrandFilter(brand);
    if (page !== currentPage) setCurrentPage(page);
  }, [searchParams]);

  const handleFilterChange = (updates: {
    q?: string;
    status?: string;
    payment?: string;
    brand?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.q !== undefined) {
      if (updates.q) params.set("q", updates.q);
      else params.delete("q");
      setSearchQuery(updates.q);
    }
    if (updates.status !== undefined) {
      if (updates.status === "VOIDED") params.set("status", "VOIDED");
      else params.delete("status");
      setStatusFilter(updates.status);
    }
    if (updates.payment !== undefined) {
      if (updates.payment) params.set("payment", updates.payment);
      else params.delete("payment");
      setPaymentFilter(updates.payment);
    }
    if (updates.brand !== undefined) {
      if (updates.brand) params.set("brand", updates.brand);
      else params.delete("brand");
      setBrandFilter(updates.brand);
    }

    // A filter change starts again from page 1.
    params.delete("page");
    setCurrentPage(1);

    startFilterTransition(() => {
      if (updates.q !== undefined) {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      } else {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }
    });
  };

  const handleDateRangeChange = (nextRange: RangeValue) => {
    const params = new URLSearchParams(searchParams.toString());
    writeRangeParams(params, nextRange);
    params.delete("page");
    setCurrentPage(1);
    startFilterTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const handleApply = () => {
    handleFilterChange({
      q: searchQuery,
    });
  };

  const ITEMS_PER_PAGE = itemsPerPage;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setPaymentFilter("");
    setBrandFilter("");
    setCurrentPage(1);
    startFilterTransition(() => {
      router.push(pathname, { scroll: false });
    });
  };

  const hasActiveFilters = Boolean(
    searchQuery ||
    statusFilter === "VOIDED" ||
    paymentFilter ||
    brandFilter ||
    searchParams.get("q") ||
    searchParams.get("status") ||
    searchParams.get("payment") ||
    searchParams.get("brand") ||
    searchParams.get("range") ||
    searchParams.get("from") ||
    searchParams.get("to")
  );

  const activeCount =
    (searchParams.get("q")?.trim() ? 1 : 0) +
    (searchParams.get("status") === "VOIDED" ? 1 : 0) +
    (searchParams.get("payment") ? 1 : 0) +
    (searchParams.get("brand") ? 1 : 0) +
    ((searchParams.get("range") && searchParams.get("range") !== "THIS_MONTH") ||
    searchParams.get("from") ||
    searchParams.get("to")
      ? 1
      : 0);

  function getPageUrl(pageNum: number): string {
    const params = new URLSearchParams(searchParams.toString());
    if (pageNum === 1) {
      params.delete("page");
    } else {
      params.set("page", String(pageNum));
    }
    const qStr = params.toString();
    return qStr ? `${pathname}?${qStr}` : pathname;
  }

  const columns: DataColumn<Order>[] = useMemo(
    () => [
      {
        key: "order_no",
        header: "Mã đơn",
        render: (order) => (
          <div className="space-y-1">
            <div className="flex items-center">
              <span className="font-mono text-[13px] text-primary transition-colors">
                {order.display_order_no || order.order_no}
              </span>
              {order.parent_order_id && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-primary-soft text-primary">
                  v{order.version}
                </span>
              )}
            </div>
            {order.status === "VOIDED" && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="danger">Đã huỷ</Badge>
                {order.void_reason && (
                  <span className="text-[13px] text-text-muted" title={order.void_reason}>
                    {order.void_reason}
                  </span>
                )}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "created_at",
        header: "Thời gian",
        render: (order) => (
          <span className="text-text-secondary text-[13px] tabular-nums">
            {formatDateTimeFull(order.created_at)}
          </span>
        ),
      },
      {
        key: "lines",
        header: "Sản phẩm (chi tiết)",
        render: (order) => (
          <div className="space-y-1.5 text-[13px]">
            {order.lines &&
              order.lines.map((line: OrderLine, idx: number) => (
                <div key={idx} className="text-[13px] text-text-secondary">
                  <span className="text-text-primary">{line.qty}x</span> {line.product_name}{" "}
                  <span className="text-text-muted">({line.size_name})</span>
                  {line.modifiers && line.modifiers.length > 0 && (
                    <div className="text-[13px] text-text-muted ml-4 mt-0.5">
                      + {line.modifiers.map((m: any) => m.name).join(", ")}
                    </div>
                  )}
                </div>
              ))}
          </div>
        ),
      },
      {
        key: "net_total",
        header: "Khách trả",
        align: "right",
        render: (order) => (
          <span className="tabular-nums text-text-primary text-[13px]">
            {formatNumber(order.net_total)}
          </span>
        ),
      },
      {
        key: "method",
        header: "Phương thức",
        render: (order) => renderPaymentMethodBadge(order),
      },
    ],
    []
  );

  return (
    <div className="space-y-4">
      <ListPageHeader
        group="Bán hàng"
        title="Đơn hàng"
      />

      <FilterCard
        onApply={handleApply}
        onClear={clearFilters}
        showClear={hasActiveFilters}
        activeCount={activeCount}
        search={
          <div className="flex-1 min-w-[200px]">
            <Field label="Tìm mã đơn" htmlFor="search-order-no">
              <TextInput
                id="search-order-no"
                placeholder="Ví dụ: 261012001030"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
        <div className="w-full md:w-36">
          <Field label="Trạng thái" htmlFor="status-filter">
            <Select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => handleFilterChange({ status: e.target.value })}
            >
              <option value="">Hoàn tất</option>
              <option value="VOIDED">Đã huỷ</option>
            </Select>
          </Field>
        </div>
        <div className="w-full md:w-44">
          <Field label="Phương thức thanh toán" htmlFor="payment-filter">
            <Select
              id="payment-filter"
              value={paymentFilter}
              onChange={(e) => handleFilterChange({ payment: e.target.value })}
            >
              <option value="">Tất cả</option>
              <option value="Tien mat">Tiền mặt</option>
              <option value="Chuyen khoan">Chuyển khoản</option>
            </Select>
          </Field>
        </div>
        <div className="w-full md:w-44">
          <Field label="Thương hiệu" htmlFor="brand-filter">
            <Select
              id="brand-filter"
              value={brandFilter}
              onChange={(e) => handleFilterChange({ brand: e.target.value })}
            >
              <option value="">Tất cả</option>
              {brands.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FilterCard>

      {isPendingFilter && (
        <div className="text-text-muted text-sm animate-pulse">Đang tải...</div>
      )}

      <div
        className={`transition-opacity ${
          isPendingFilter ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <DataList
          rows={orders}
          getId={(order) => order.id}
          getName={(order) => order.display_order_no || order.order_no}
          getHref={(order) =>
            `/admin/orders/${encodeURIComponent(order.id)}?returnTo=${returnTo}`
          }
          columns={columns}
          phoneRow={(order) => {
            const orderCode = order.display_order_no || order.order_no;
            const title = order.parent_order_id
              ? `${orderCode} · v${order.version}`
              : orderCode;

            const itemsSummary = (order.lines ?? [])
              .map((line: OrderLine) => {
                const size = line.size_name ? ` (${line.size_name})` : "";
                const mods =
                  line.modifiers && line.modifiers.length > 0
                    ? ` + ${line.modifiers.map((m: any) => m.name).join(", ")}`
                    : "";
                return `${line.qty}x ${line.product_name}${size}${mods}`;
              })
              .join(", ");

            const timeStr = formatDateTimeFull(order.created_at);
            const meta = [timeStr, itemsSummary].filter(Boolean).join(" · ");

            return {
              title,
              value: formatNumber(order.net_total),
              meta,
              badge:
                order.status === "VOIDED" ? (
                  <Badge variant="danger">Đã huỷ</Badge>
                ) : (
                  renderPaymentMethodBadge(order)
                ),
            };
          }}
          totals={
            totals && statusFilter !== "VOIDED" && searchParams.get("status") !== "VOIDED"
              ? {
                  label: "Tổng (không tính huỷ)",
                  values: { net_total: formatNumber(totals.netTotal) },
                }
              : undefined
          }
          empty={
            <EmptyState
              icon={<span className="text-4xl">📦</span>}
              title={
                searching
                  ? "Không tìm thấy đơn hàng nào trên mọi ngày"
                  : `Không có đơn hàng nào trong ${formatEmptyRangePart(range)}`
              }
              action={{
                label: "Xoá lọc",
                onClick: clearFilters,
              }}
            />
          }
        />
      </div>

      {totalCount > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm mt-4">
          <ListPagination
            slice={{
              page: currentPage,
              pageCount: totalPages,
              firstIndex: (currentPage - 1) * ITEMS_PER_PAGE + 1,
              lastIndex: Math.min(currentPage * ITEMS_PER_PAGE, totalCount),
              total: totalCount,
            }}
            unit="đơn"
            pageHref={getPageUrl}
          />
        </div>
      )}
    </div>
  );
}
