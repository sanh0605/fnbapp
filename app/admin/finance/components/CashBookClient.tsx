"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { Badge } from "@/components/ui/Badge";
import { DateRangeFilter, type DateRangeValue } from "@/components/ui/DateRangeFilter";
import { formatDate, formatVnDay } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { cancelCashEntry } from "@/app/admin/finance/actions";
import { cancelCashTransfer } from "@/app/admin/finance/transfers/actions";
import type { DBBankAccount, DBCashCategory } from "@/types/db";
import type { CashBookRow } from "@/lib/finance/cash-book-rows";
import type { CashBookSummary, Balance } from "@/lib/finance/cash-flow";
import type { DateRangePresetKey } from "@/lib/shared/date-range-presets";

export interface CashBookClientProps {
  rows: CashBookRow[];
  summary: CashBookSummary;
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
  canDelete: boolean;
  today: string;
  resolvedRange: {
    preset: DateRangePresetKey;
    start: string;
    end: string;
  };
  initialKind?: string;
  initialStatus?: string;
  initialPage?: string;
}

const VALID_KINDS = ["ALL", "SALE", "PURCHASE", "HAND", "TRANSFER"] as const;
type CashBookKindFilter = (typeof VALID_KINDS)[number];

function parseKind(raw: string | null | undefined): CashBookKindFilter {
  if (
    raw === "SALE" ||
    raw === "PURCHASE" ||
    raw === "HAND" ||
    raw === "TRANSFER"
  ) {
    return raw;
  }
  return "ALL";
}

const VALID_STATUSES = ["ACTIVE", "CANCELLED", "ALL"] as const;
type CashEntryStatusFilter = (typeof VALID_STATUSES)[number];

function parseStatus(raw: string | null | undefined): CashEntryStatusFilter {
  if (raw === "CANCELLED" || raw === "ALL") return raw;
  return "ACTIVE";
}

function display(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "—";
}

function money(value: number): string {
  return `${formatNumber(value)}đ`;
}

function listUrl(
  range: DateRangeValue,
  kind: CashBookKindFilter,
  status: CashEntryStatusFilter,
  page: number = 1,
  sort?: string,
  dir?: string,
): string {
  const p = new URLSearchParams();
  if (range.preset) p.set("preset", range.preset);
  if (range.preset === "CUSTOM") {
    if (range.start) p.set("start", range.start);
    if (range.end) p.set("end", range.end);
  }
  if (kind && kind !== "ALL") p.set("kind", kind);
  if (status && status !== "ACTIVE") p.set("status", status);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/finance?${qs}` : "/admin/finance";
}

function BalanceBlock({
  title,
  balance,
  testIdPrefix,
}: {
  title: string;
  balance: Balance;
  testIdPrefix: "opening" | "closing";
}) {
  return (
    <div className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm space-y-3">
      <div className="text-sm font-semibold text-text-primary">{title}</div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-xs text-text-muted">Tiền mặt</div>
          <div
            data-testid={`${testIdPrefix}-cash`}
            className={`font-semibold mt-1 text-sm sm:text-base ${
              balance.cash < 0 ? "text-danger" : "text-text-primary"
            }`}
          >
            {money(balance.cash)}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Ngân hàng</div>
          <div
            data-testid={`${testIdPrefix}-bank`}
            className={`font-semibold mt-1 text-sm sm:text-base ${
              balance.bank < 0 ? "text-danger" : "text-text-primary"
            }`}
          >
            {money(balance.bank)}
          </div>
        </div>
        <div>
          <div className="text-xs text-text-muted">Tổng</div>
          <div
            data-testid={`${testIdPrefix}-total`}
            className={`font-bold mt-1 text-sm sm:text-base ${
              balance.total < 0 ? "text-danger" : "text-text-primary"
            }`}
          >
            {money(balance.total)}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CashBookClient({
  rows,
  summary,
  canDelete: _canDelete,
  today,
  resolvedRange,
  initialKind,
  initialStatus,
  initialPage,
}: CashBookClientProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [range, setRange] = useState<DateRangeValue>(() => ({
    preset: resolvedRange.preset,
    start: resolvedRange.start,
    end: resolvedRange.end,
  }));

  const [kind, setKind] = useState<CashBookKindFilter>(() =>
    parseKind(initialKind ?? searchParams?.get("kind")),
  );

  const [status, setStatus] = useState<CashEntryStatusFilter>(() =>
    parseStatus(initialStatus ?? searchParams?.get("status")),
  );

  const [page, setPage] = useState<string | number | undefined>(
    () => initialPage ?? searchParams?.get("page") ?? undefined,
  );

  useEffect(() => {
    setRange({
      preset: resolvedRange.preset,
      start: resolvedRange.start,
      end: resolvedRange.end,
    });
  }, [resolvedRange.preset, resolvedRange.start, resolvedRange.end]);

  useEffect(() => {
    if (initialKind !== undefined) setKind(parseKind(initialKind));
    else if (searchParams?.get("kind") !== null)
      setKind(parseKind(searchParams?.get("kind")));
  }, [initialKind, searchParams]);

  useEffect(() => {
    if (initialStatus !== undefined) setStatus(parseStatus(initialStatus));
    else if (searchParams?.get("status") !== null)
      setStatus(parseStatus(searchParams?.get("status")));
  }, [initialStatus, searchParams]);

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage);
    else if (searchParams?.get("page") !== null)
      setPage(searchParams?.get("page") || undefined);
  }, [initialPage, searchParams]);

  const columns: DataColumn<CashBookRow>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (r) => r.id ?? "",
        render: (r) =>
          r.id ? (
            <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
              {r.id}
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          ),
      },
      {
        key: "date",
        header: "Ngày",
        sortValue: (r) => `${r.date}|${r.key}`,
        render: (r) => (
          <span className="text-text-secondary">{formatDate(r.date)}</span>
        ),
      },
      {
        key: "group",
        header: "Nhóm",
        sortValue: (r) => r.groupLabel,
        render: (r) => (
          <span className="font-medium text-text-primary">
            {r.groupLabel}
          </span>
        ),
      },
      {
        key: "side",
        header: "Bên",
        sortValue: (r) => r.sideLabel,
        render: (r) => (
          <span className="text-text-secondary">
            {r.sideLabel}
          </span>
        ),
      },
      {
        key: "amount",
        header: "Số tiền",
        align: "right",
        sortValue: (r) => r.amount,
        render: (r) => (
          <span className="font-semibold text-text-primary">
            {money(r.amount)}
          </span>
        ),
      },
      {
        key: "method",
        header: "Cách trả",
        secondary: true,
        sortValue: (r) => r.methodLabel,
        render: (r) => (
          <span className="text-text-secondary">
            {r.methodLabel}
          </span>
        ),
      },
      {
        key: "account",
        header: "Tài khoản",
        secondary: true,
        sortValue: (r) => r.accountLabel,
        render: (r) => (
          <span className="text-text-secondary">
            {r.accountLabel}
          </span>
        ),
      },
      {
        key: "note",
        header: "Ghi chú",
        sortValue: (r) => r.note,
        render: (r) => (
          <span className="text-text-secondary">{display(r.note)}</span>
        ),
      },
      {
        key: "creator",
        header: "Người tạo",
        secondary: true,
        sortValue: (r) => r.creator,
        render: (r) => (
          <span className="text-text-secondary">{display(r.creator)}</span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        sortValue: (r) =>
          r.kind === "SALE" || r.kind === "PURCHASE"
            ? ""
            : r.status === "ACTIVE"
              ? "Đang dùng"
              : "Đã huỷ",
        render: (r) => {
          if (r.kind === "SALE" || r.kind === "PURCHASE") return null;
          return r.status === "ACTIVE" ? (
            <Badge variant="success">Đang dùng</Badge>
          ) : (
            <Badge variant="neutral">Đã huỷ</Badge>
          );
        },
      },
    ],
    [],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  // Default sort is Ngày, newest first
  const { key: sortKey, dir: sortDir } = parseSort(
    rawSort,
    rawDir,
    validSortKeys,
    "date",
  );
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (kind !== "ALL" && row.kind !== kind) return false;
      if (status === "ACTIVE") return row.status === "ACTIVE";
      if (status === "CANCELLED") return row.status === "CANCELLED";
      return true; // status === "ALL"
    });
  }, [rows, kind, status]);

  const sortedRows = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredRows, col.sortValue, sortDir)
      : filteredRows;
  }, [filteredRows, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedRows, page);
  }, [sortedRows, page]);

  const currentListUrl = listUrl(
    range,
    kind,
    status,
    slice.page,
    sortParam,
    dirParam,
  );

  const handleDateRangeChange = (nextRange: DateRangeValue) => {
    setRange(nextRange);
    setPage(1);
    router.replace(listUrl(nextRange, kind, status, 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const handleApplyFilters = () => {
    setPage(1);
    router.replace(listUrl(range, kind, status, 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const handleClearFilter = () => {
    setKind("ALL");
    setStatus("ACTIVE");
    setPage(1);
    router.replace(listUrl(range, "ALL", "ACTIVE", 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const getRowHref = (row: CashBookRow) => {
    if (row.kind === "HAND" || row.kind === "TRANSFER") {
      const separator = row.href.includes("?") ? "&" : "?";
      return `${row.href}${separator}returnTo=${encodeURIComponent(currentListUrl)}`;
    }
    return row.href;
  };

  const renderCard = (row: CashBookRow) => {
    const isCancelled = row.status === "CANCELLED";
    const isDayRow = row.kind === "SALE" || row.kind === "PURCHASE";

    return (
      <div className={`flex flex-col gap-2 ${isCancelled ? "opacity-60" : ""}`}>
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="font-bold text-text-primary text-base leading-tight">
              {row.groupLabel}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5 font-mono">
              {row.id ? `${row.id} · ` : ""}
              {formatDate(row.date)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="font-bold text-text-primary">
              {money(row.amount)}
            </span>
            {!isDayRow &&
              (row.status === "ACTIVE" ? (
                <Badge variant="success">Đang dùng</Badge>
              ) : (
                <Badge variant="neutral">Đã huỷ</Badge>
              ))}
          </div>
        </div>
        <div className="text-xs text-text-secondary pt-1 border-t border-border/50 flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-text-muted">Bên:</span>
            <span>{row.sideLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Cách trả:</span>
            <span>{row.methodLabel}</span>
          </div>
          {row.accountLabel !== "—" && (
            <div className="flex justify-between">
              <span className="text-text-muted">Tài khoản:</span>
              <span>{row.accountLabel}</span>
            </div>
          )}
          {row.note && (
            <div className="flex justify-between">
              <span className="text-text-muted">Ghi chú:</span>
              <span className="truncate max-w-[200px]">{row.note}</span>
            </div>
          )}
          {row.creator !== "—" && (
            <div className="flex justify-between">
              <span className="text-text-muted">Người tạo:</span>
              <span>{row.creator}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const removal =
    status === "ACTIVE"
      ? {
          verb: "Huỷ",
          canRemove: (r: CashBookRow) =>
            r.kind === "HAND" || r.kind === "TRANSFER",
          confirmMessage: (count: number) =>
            `Huỷ ${count} dòng sổ? Dòng vẫn hiện trong sổ nhưng không tính vào tổng nữa.`,
          remove: async (key: string) => {
            const row = rows.find((r) => r.key === key || r.id === key);
            const targetId = row?.id ?? key;
            const fd = new FormData();
            fd.set("id", targetId);
            if (row?.kind === "TRANSFER") {
              const res = await cancelCashTransfer(fd);
              if (res?.error) {
                return { error: res.error };
              }
              return {};
            }
            const res = await cancelCashEntry(fd);
            if (res?.error) {
              return { error: res.error };
            }
            return {};
          },
        }
      : undefined;

  const openingDateLabel =
    formatVnDay(resolvedRange.start) || formatDate(resolvedRange.start);
  const closingDateLabel =
    formatVnDay(resolvedRange.end) || formatDate(resolvedRange.end);

  return (
    <div className="space-y-6">
      {/* 1. FilterCard */}
      <FilterCard
        onApply={handleApplyFilters}
        onClear={handleClearFilter}
        showClear={status !== "ACTIVE" || kind !== "ALL"}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-auto">
          <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">
            Thời gian
          </label>
          <DateRangeFilter
            value={range}
            today={today}
            onChange={handleDateRangeChange}
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-44">
          <label
            htmlFor="cashbook-kind"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Loại
          </label>
          <select
            id="cashbook-kind"
            value={kind}
            onChange={(e) => {
              const nextKind = parseKind(e.target.value);
              setKind(nextKind);
              setPage(1);
            }}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ALL">Tất cả</option>
            <option value="SALE">Bán hàng</option>
            <option value="PURCHASE">Nhập hàng</option>
            <option value="HAND">Ghi tay</option>
            <option value="TRANSFER">Chuyển tiền</option>
          </select>
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-44">
          <label
            htmlFor="cashbook-status"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Trạng thái
          </label>
          <select
            id="cashbook-status"
            value={status}
            onChange={(e) => {
              const nextStatus = parseStatus(e.target.value);
              setStatus(nextStatus);
              setPage(1);
            }}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ACTIVE">Đang dùng</option>
            <option value="CANCELLED">Đã huỷ</option>
            <option value="ALL">Tất cả</option>
          </select>
        </div>
      </FilterCard>

      {/* 2. Balance and Totals blocks */}
      <div className="space-y-3">
        {/* Balance cards: Đầu kỳ and Cuối kỳ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <BalanceBlock
            title={`Đầu kỳ (${openingDateLabel})`}
            balance={summary.opening}
            testIdPrefix="opening"
          />
          <BalanceBlock
            title={`Cuối kỳ (${closingDateLabel})`}
            balance={summary.closing}
            testIdPrefix="closing"
          />
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm">
            <div className="text-sm text-text-muted">Tổng chi</div>
            <div
              data-testid="total-expense"
              className="text-xl font-bold text-danger mt-1"
            >
              {money(summary.totals.totalExpense)}
            </div>
          </div>
          <div
            data-testid="total-income"
            className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm"
          >
            <div className="text-sm text-text-muted">Tổng thu</div>
            <div className="text-xl font-bold text-success mt-1">
              {money(summary.totals.totalIncome)}
            </div>
            <div className="text-xs text-text-muted mt-2 pt-2 border-t border-border">
              Trong đó thu ngoài lãi lỗ (vốn góp, ...):{" "}
              <span
                data-testid="income-outside-pnl"
                className="font-medium text-text-primary"
              >
                {money(summary.totals.incomeOutsidePnl)}
              </span>
            </div>
          </div>
        </div>

        {(summary.byGroup.length > 0 ||
          summary.unknownCategoryIds.length > 0) && (
          <div
            data-testid="by-category"
            className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm"
          >
            <div className="text-sm text-text-muted mb-2">Theo nhóm</div>
            <div className="space-y-1 text-sm">
              {summary.byGroup.map((g) => (
                <div
                  key={g.key}
                  className="flex justify-between text-text-primary"
                >
                  <span>{g.name}</span>
                  <span className="font-medium">{money(g.total)}</span>
                </div>
              ))}
              {summary.unknownCategoryIds.length > 0 && (
                <div className="text-danger">
                  Có dòng thuộc nhóm không còn trong danh sách
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. DataList */}
      <DataList
        rows={slice.rows}
        getId={(r) => r.key}
        getName={(r) => `${r.groupLabel} (${money(r.amount)})`}
        getHref={getRowHref}
        columns={columns}
        renderCard={renderCard}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(range, kind, status, 1, k, d),
        }}
        removal={removal}
        empty={
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
            <div className="text-text-secondary text-sm">
              Chưa có khoản nào trong khoảng này
            </div>
            {(status !== "ACTIVE" || kind !== "ALL") && (
              <div>
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="text-danger hover:underline font-medium text-sm min-h-[44px] inline-flex items-center"
                >
                  Xoá lọc
                </button>
              </div>
            )}
          </div>
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="dòng sổ"
            pageHref={(p) => listUrl(range, kind, status, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
