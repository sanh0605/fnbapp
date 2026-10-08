"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { DayInput } from "@/components/ui/DayInput";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { formatDateTime } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";

import type { OrderListItem } from "./actions";

type OrderLine = OrderListItem["lines"][0];
type Order = OrderListItem;

interface Brand {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

interface Variant {
  id: string;
  size_name: string;
}

interface Modifier {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

export default function OrderTable({
  initialOrders,
  totalCount,
  itemsPerPage,
  brands,
  products: _products,
  variants: _variants,
  modifiers: _modifiers,
  categories: _categories,
}: {
  initialOrders: Order[];
  totalCount: number;
  itemsPerPage: number;
  brands: Brand[];
  products: Product[];
  variants: Variant[];
  modifiers: Modifier[];
  categories: Category[];
}) {
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
  const [startDate, setStartDate] = useState<string>(() => {
    return searchParams.get("from") || "";
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return searchParams.get("to") || "";
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
    const payment = searchParams.get("payment") || "";
    const brand = searchParams.get("brand") || "";
    const pageVal = searchParams.get("page");
    const page = pageVal ? parseInt(pageVal, 10) || 1 : 1;
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";

    if (q !== searchQuery) setSearchQuery(q);
    if (payment !== paymentFilter) setPaymentFilter(payment);
    if (brand !== brandFilter) setBrandFilter(brand);
    if (page !== currentPage) setCurrentPage(page);
    if (from !== startDate) setStartDate(from);
    if (to !== endDate) setEndDate(to);
  }, [searchParams]);

  const handleFilterChange = (updates: {
    page?: number;
    q?: string;
    from?: string | null;
    to?: string | null;
    payment?: string;
    brand?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.q !== undefined) {
      if (updates.q) params.set("q", updates.q);
      else params.delete("q");
      setSearchQuery(updates.q);
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
    if (updates.from !== undefined) {
      if (updates.from && updates.from !== "invalid") params.set("from", updates.from);
      else params.delete("from");
      setStartDate(updates.from || "");
    }
    if (updates.to !== undefined) {
      if (updates.to && updates.to !== "invalid") params.set("to", updates.to);
      else params.delete("to");
      setEndDate(updates.to || "");
    }

    let targetPage = 1;
    if (updates.page !== undefined) {
      targetPage = updates.page;
    } else {
      const isFilterChange =
        updates.q !== undefined ||
        updates.payment !== undefined ||
        updates.brand !== undefined ||
        updates.from !== undefined ||
        updates.to !== undefined;
      if (!isFilterChange) {
        const pageVal = params.get("page");
        targetPage = pageVal ? parseInt(pageVal, 10) || 1 : 1;
      }
    }

    if (targetPage === 1) {
      params.delete("page");
      setCurrentPage(1);
    } else {
      params.set("page", String(targetPage));
      setCurrentPage(targetPage);
    }

    startFilterTransition(() => {
      if (updates.q !== undefined) {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      } else {
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      }
    });
  };

  const ITEMS_PER_PAGE = itemsPerPage;
  const totalPages = Math.max(1, Math.ceil(totalCount / ITEMS_PER_PAGE));

  const clearFilters = () => {
    handleFilterChange({
      q: "",
      from: "",
      to: "",
      payment: "",
      brand: "",
      page: 1,
    });
  };

  const hasActiveFilters = Boolean(
    searchQuery || startDate || endDate || paymentFilter || brandFilter
  );

  const rightContent = (
    <>
      {hasActiveFilters && (
        <Button
          variant="secondary"
          onClick={clearFilters}
        >
          Xóa bộ lọc
        </Button>
      )}
      <div className="text-xs font-bold text-text-secondary whitespace-nowrap px-3 py-1.5 bg-surface-secondary rounded-lg">
        {orders.length} / {totalCount}
      </div>
    </>
  );

  const columns: DataColumn<Order>[] = useMemo(
    () => [
      {
        key: "order_no",
        header: "Mã đơn",
        render: (order) => (
          <div className="flex items-center">
            <span className="font-mono text-xs text-primary transition-colors">
              {order.display_order_no || order.order_no}
            </span>
            {order.parent_order_id && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-primary-soft text-primary">
                v{order.version}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "created_at",
        header: "Thời gian",
        render: (order) => (
          <span className="text-text-secondary">{formatDateTime(order.created_at)}</span>
        ),
      },
      {
        key: "lines",
        header: "Sản phẩm (chi tiết)",
        render: (order) => (
          <div className="space-y-1.5">
            {order.lines &&
              order.lines.map((line: OrderLine, idx: number) => (
                <div key={idx} className="text-xs text-text-secondary">
                  <span className="text-text-primary">{line.qty}x</span> {line.product_name}{" "}
                  <span className="text-text-muted">({line.size_name})</span>
                  {line.modifiers && line.modifiers.length > 0 && (
                    <div className="text-[10px] text-text-muted ml-4 mt-0.5">
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
        header: "Tổng tiền",
        align: "right",
        render: (order) => (
          <span className="tabular-nums text-text-primary">
            {formatNumber(order.net_total)}
          </span>
        ),
      },
      {
        key: "method",
        header: "Phương thức",
        render: (order) =>
          order.method === "Chuyen khoan" ? (
            <Badge variant="neutral">Chuyển khoản</Badge>
          ) : (
            <Badge variant="success">Tiền mặt</Badge>
          ),
      },
    ],
    []
  );

  const renderCard = (order: Order) => (
    <div className="space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <span className="font-mono text-xs text-primary">
            {order.display_order_no || order.order_no}
          </span>
          {order.parent_order_id && (
            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-primary-soft text-primary">
              v{order.version}
            </span>
          )}
          <p className="text-[11px] text-text-muted mt-0.5">
            {formatDateTime(order.created_at)}
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm tabular-nums text-text-primary">
            {formatNumber(order.net_total)}
          </div>
          <div className="mt-1">
            {order.method === "Chuyen khoan" ? (
              <Badge variant="neutral">Chuyển khoản</Badge>
            ) : (
              <Badge variant="success">Tiền mặt</Badge>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-2 space-y-1">
        {order.lines &&
          order.lines.map((line: OrderLine, idx: number) => (
            <div key={idx} className="text-xs text-text-secondary">
              <span className="text-text-primary">{line.qty}x</span> {line.product_name}{" "}
              <span className="text-text-muted">({line.size_name})</span>
              {line.modifiers && line.modifiers.length > 0 && (
                <div className="text-[10px] text-text-muted ml-4 mt-0.5">
                  + {line.modifiers.map((m: any) => m.name).join(", ")}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Đơn hàng"
        subtitle="Quản lý và xem lại tất cả các đơn hàng đã được tạo."
        actions={rightContent}
      />

      <FilterCard
        onApply={() =>
          handleFilterChange({
            q: searchQuery,
            from: startDate,
            to: endDate,
            payment: paymentFilter,
            brand: brandFilter,
          })
        }
        onClear={clearFilters}
        showClear={false}
      >
        <div className="flex-1 min-w-[200px]">
          <Field label="Tìm mã đơn" htmlFor="search-order-no">
            <TextInput
              id="search-order-no"
              placeholder="Ví dụ: PHD000001"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && handleFilterChange({ q: searchQuery })
              }
            />
          </Field>
        </div>
        <div className="w-full md:w-40">
          <DayInput
            label="Từ ngày"
            value={startDate}
            onChange={(val) => {
              const cleaned = val === "invalid" ? "" : val;
              setStartDate(cleaned);
              handleFilterChange({ from: cleaned });
            }}
          />
        </div>
        <div className="w-full md:w-40">
          <DayInput
            label="Đến ngày"
            value={endDate}
            onChange={(val) => {
              const cleaned = val === "invalid" ? "" : val;
              setEndDate(cleaned);
              handleFilterChange({ to: cleaned });
            }}
          />
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
          renderCard={renderCard}
          empty="Không tìm thấy đơn hàng nào"
        />
      </div>

      {totalPages > 1 && (
        <div className="bg-page rounded-card shadow-sm border border-border px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-text-secondary text-center sm:text-left">
            Hiển thị{" "}
            <span className="font-bold text-text-primary">
              {(currentPage - 1) * ITEMS_PER_PAGE + 1}
            </span>{" "}
            đến{" "}
            <span className="font-bold text-text-primary">
              {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}
            </span>{" "}
            trong tổng số{" "}
            <span className="font-bold text-text-primary">{totalCount}</span> đơn hàng
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => handleFilterChange({ page: Math.max(1, currentPage - 1) })}
              disabled={currentPage === 1}
            >
              Trước
            </Button>
            <div className="flex items-center px-2 font-medium text-text-secondary text-sm">
              Trang {currentPage} / {totalPages}
            </div>
            <Button
              variant="secondary"
              onClick={() =>
                handleFilterChange({ page: Math.min(totalPages, currentPage + 1) })
              }
              disabled={currentPage === totalPages}
            >
              Sau
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
