"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { DateRangeButton } from "@/components/ui/DateRangeButton";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { formatNumber } from "@/lib/shared/format";
import { useFilterForm } from "@/lib/shared/use-filter-form";
import {
  formatRangeButtonText,
  writeRangeParams,
  type RangeValue,
} from "@/lib/shared/date-range-params";
import type { PurchaseOrderListPage } from "@/lib/purchasing/purchase-order-list";

function formatEmptyRangePart(range: RangeValue): string {
  const text = formatRangeButtonText(range);
  const [preset, ...rest] = text.split(" · ");
  return `${preset} (${rest.join(" · ")})`;
}

export interface PurchaseOrdersClientProps {
  pageData: PurchaseOrderListPage & { suppliers: { id: string; name: string }[] };
  range: RangeValue;
  today: string;
  searching?: boolean;
}

type PurchaseOrderRow = PurchaseOrderListPage["rows"][number];

function renderStatusBadge(status: string) {
  if (status === "COMPLETED") {
    return <Badge variant="success">Hoàn thành</Badge>;
  }
  if (status === "CANCELLED") {
    return <Badge variant="neutral">Đã huỷ</Badge>;
  }
  if (status === "DRAFT") {
    return <Badge variant="warning">Nháp</Badge>;
  }
  return <Badge variant="neutral">{status}</Badge>;
}

export default function PurchaseOrdersClient({
  pageData,
  range,
  today,
  searching = false,
}: PurchaseOrdersClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();


  const defaultFilters = {
    q: "",
    status: "ACTIVE",
    supplier: "ALL",
    page: "1",
    pay: "ALL",
  };
  const { draft, setField, applyFilters, isPending } = useFilterForm(defaultFilters);
  const [applyRequested, setApplyRequested] = useState(false);

  const hasAnyFilter = Boolean(
    searchParams.get("q") ||
      (searchParams.get("status") && searchParams.get("status") !== "ACTIVE") ||
      (searchParams.get("supplier") && searchParams.get("supplier") !== "ALL") ||
      (searchParams.get("pay") && searchParams.get("pay") !== "ALL") ||
      searchParams.get("account") ||
      (searchParams.get("range") && searchParams.get("range") !== "THIS_MONTH") ||
      searchParams.get("from") ||
      searchParams.get("to")
  );
  const draftChanged =
    draft.q !== defaultFilters.q ||
    draft.status !== defaultFilters.status ||
    draft.supplier !== defaultFilters.supplier ||
    draft.pay !== defaultFilters.pay;
  const showClear = hasAnyFilter || draftChanged;

  useEffect(() => {
    if (!applyRequested) return;
    setApplyRequested(false);
    handleApply();
  }, [applyRequested, draft]);

  function handleApply() {
    applyFilters({ page: "1" });
  }

  function handleClear() {
    setField("q", "");
    setField("status", "ACTIVE");
    setField("supplier", "ALL");
    setField("pay", "ALL");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.delete("from");
    params.delete("to");
    params.delete("q");
    params.delete("status");
    params.delete("supplier");
    params.delete("pay");
    params.delete("account");
    params.delete("page");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function handleDateRangeChange(nextRange: RangeValue) {
    const params = new URLSearchParams(searchParams.toString());
    writeRangeParams(params, nextRange);
    params.delete("page");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  const { page, pageCount, firstIndex, lastIndex, total, rows, rangeError } = pageData;

  const currentListUrl = searchParams.toString()
    ? `/admin/inventory/purchase-orders?${searchParams.toString()}`
    : "/admin/inventory/purchase-orders";

  function getPageUrl(pageNum: number): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNum));
    return `?${params.toString()}`;
  }

  const columns: DataColumn<PurchaseOrderRow>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã phiếu",
        render: (po) => (
          <span className="font-mono text-xs text-primary transition-colors">{po.id}</span>
        ),
      },
      {
        key: "dateText",
        header: "Ngày nhập",
        render: (po) => (
          <span className="tabular-nums text-text-primary whitespace-nowrap">{po.dateText}</span>
        ),
      },
      {
        key: "supplierName",
        header: "Nhà cung cấp",
        render: (po) => (
          <span className="text-text-primary truncate max-w-[280px]" title={po.supplierName}>
            {po.supplierName}
          </span>
        ),
      },
      {
        key: "sourceName",
        header: "Nguồn mua",
        render: (po) => <span className="text-text-primary">{po.sourceName}</span>,
      },
      {
        key: "status",
        header: "Trạng thái",
        render: (po) => renderStatusBadge(po.status),
      },
      {
        key: "paymentLabel",
        header: "Hình thức thanh toán",
        render: (po) => (
          <span className="text-text-secondary whitespace-nowrap">{po.paymentLabel}</span>
        ),
      },
      {
        key: "totalAmount",
        header: "Tổng tiền",
        align: "right",
        render: (po) => (
          <span className="text-text-primary tabular-nums">{formatNumber(po.totalAmount)}đ</span>
        ),
      },
    ],
    []
  );

  const renderCard = (po: PurchaseOrderRow) => (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <span className="font-mono text-xs text-primary">{po.id}</span>
        <span className="tabular-nums text-text-primary text-base font-medium">
          {formatNumber(po.totalAmount)}đ
        </span>
      </div>
      <div className="text-text-primary line-clamp-2 leading-tight">{po.supplierName}</div>
      <div className="flex justify-between items-end gap-2">
        <div className="text-xs text-text-secondary">
          {po.dateText} · {po.sourceName} · {po.paymentLabel}
        </div>
        <div>{renderStatusBadge(po.status)}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <ListPageHeader
        group=""
        title="Phiếu nhập"
        action={
          <Button
            href="/admin/inventory/purchase-orders/new"
            variant="primary"
            className="w-full md:w-auto"
          >
            Tạo
          </Button>
        }
      />

      <FilterCard
        onApply={() => setApplyRequested(true)}
        onClear={handleClear}
        showClear={showClear}
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
        <div className="flex-1 min-w-[200px]">
          <Field label="Tìm kiếm" htmlFor="search-input">
            <TextInput
              id="search-input"
              placeholder="Ví dụ: PO-181"
              value={draft.q}
              onChange={(e) => setField("q", e.target.value)}
            />
          </Field>
        </div>
        <div className="w-full md:w-40">
          <Field label="Trạng thái" htmlFor="status-select">
            <Select
              id="status-select"
              value={draft.status}
              onChange={(e) => setField("status", e.target.value)}
            >
              <option value="ACTIVE">Chưa huỷ</option>
              <option value="DRAFT">Nháp</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="CANCELLED">Đã huỷ</option>
              <option value="ALL">Tất cả</option>
            </Select>
          </Field>
        </div>
        <div className="w-full md:w-40">
          <Field label="Hình thức thanh toán" htmlFor="pay-select">
            <Select
              id="pay-select"
              value={draft.pay}
              onChange={(e) => setField("pay", e.target.value)}
            >
              <option value="ALL">Tất cả</option>
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER">Chuyển khoản</option>
            </Select>
          </Field>
        </div>
        <div className="w-full md:w-48">
          <Field label="Nhà cung cấp" htmlFor="supplier-select">
            <Select
              id="supplier-select"
              value={draft.supplier}
              onChange={(e) => setField("supplier", e.target.value)}
            >
              <option value="ALL">Tất cả</option>
              {pageData.suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FilterCard>

      {isPending && <div className="text-text-muted text-sm animate-pulse">Đang tải...</div>}

      <div className={`transition-opacity ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
        <DataList
          rows={rows}
          getId={(po) => po.id}
          getName={(po) => po.id}
          getHref={(po) =>
            `/admin/inventory/purchase-orders/${po.id}?returnTo=${encodeURIComponent(
              currentListUrl
            )}`
          }
          columns={columns}
          renderCard={renderCard}
          totals={{
            label: "Tổng (không tính huỷ, nháp)",
            values: { totalAmount: formatNumber(pageData.totals.totalAmount) },
          }}
          empty={
            <EmptyState
              icon={<span className="text-4xl">📦</span>}
              title={
                searching
                  ? "Không tìm thấy phiếu nào trên mọi ngày"
                  : `Không có phiếu nào trong ${formatEmptyRangePart(range)}`
              }
              action={hasAnyFilter ? { label: "Xoá lọc", onClick: handleClear } : undefined}
            />
          }
        />

        {total > 0 && (
          <div className="rounded-2xl border border-border overflow-hidden shadow-sm mt-4">
            <ListPagination
              slice={{ page, pageCount, firstIndex, lastIndex, total }}
              unit="phiếu"
              pageHref={getPageUrl}
            />
          </div>
        )}
      </div>
    </div>
  );
}
