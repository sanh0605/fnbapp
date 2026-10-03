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
import { formatDate } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { summariseEntries } from "@/lib/finance/cash-entry-rules";
import { cancelCashEntry } from "@/app/admin/finance/actions";
import type { DBBankAccount, DBCashCategory, DBCashEntry } from "@/types/db";
import type { DateRangePresetKey } from "@/lib/shared/date-range-presets";

export interface CashBookClientProps {
  entries: DBCashEntry[];
  categories: DBCashCategory[];
  accounts: DBBankAccount[];
  canDelete: boolean;
  today: string;
  resolvedRange: {
    preset: DateRangePresetKey;
    start: string;
    end: string;
  };
  initialStatus?: string;
  initialPage?: string;
}

const VALID_STATUSES = ["ACTIVE", "CANCELLED", "ALL"] as const;
type CashEntryStatusFilter = (typeof VALID_STATUSES)[number];

function parseStatus(raw: string | null | undefined): CashEntryStatusFilter {
  if (raw === "CANCELLED" || raw === "ALL") return raw;
  return "ACTIVE";
}

const PAYMENT_METHOD_LABEL: Record<DBCashEntry["payment_method"], string> = {
  CASH: "Tiền mặt",
  BANK_TRANSFER: "Chuyển khoản",
};

const KIND_LABEL: Record<DBCashCategory["kind"], string> = {
  EXPENSE: "Chi",
  INCOME: "Thu",
};

function display(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "—";
}

function money(value: number): string {
  return `${formatNumber(value)}đ`;
}

function listUrl(
  range: DateRangeValue,
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
  if (status && status !== "ACTIVE") p.set("status", status);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/finance?${qs}` : "/admin/finance";
}

export default function CashBookClient({
  entries,
  categories,
  accounts,
  today,
  resolvedRange,
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
    if (initialStatus !== undefined) setStatus(parseStatus(initialStatus));
    else if (searchParams?.get("status") !== null)
      setStatus(parseStatus(searchParams?.get("status")));
  }, [initialStatus, searchParams]);

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage);
    else if (searchParams?.get("page") !== null)
      setPage(searchParams?.get("page") || undefined);
  }, [initialPage, searchParams]);

  const categoryById = useMemo(() => {
    return new Map(categories.map((c) => [c.id, c]));
  }, [categories]);

  const accountById = useMemo(() => {
    return new Map(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  // Totals block computed over ALL entries of the date range -- never the page or status-filtered rows
  const summary = useMemo(() => {
    return summariseEntries(entries, categories);
  }, [entries, categories]);

  const columns: DataColumn<DBCashEntry>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (e) => e.id,
        render: (e) => (
          <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
            {e.id}
          </span>
        ),
      },
      {
        key: "date",
        header: "Ngày",
        sortValue: (e) => `${e.entry_date}|${e.id}`,
        render: (e) => (
          <span className="text-text-secondary">{formatDate(e.entry_date)}</span>
        ),
      },
      {
        key: "category",
        header: "Nhóm",
        sortValue: (e) => categoryById.get(e.category_id)?.name || "",
        render: (e) => (
          <span className="font-medium text-text-primary">
            {categoryById.get(e.category_id)?.name ?? "—"}
          </span>
        ),
      },
      {
        key: "kind",
        header: "Bên",
        sortValue: (e) => {
          const cat = categoryById.get(e.category_id);
          return cat ? KIND_LABEL[cat.kind] : "";
        },
        render: (e) => {
          const cat = categoryById.get(e.category_id);
          return (
            <span className="text-text-secondary">
              {cat ? KIND_LABEL[cat.kind] : "—"}
            </span>
          );
        },
      },
      {
        key: "amount",
        header: "Số tiền",
        align: "right",
        sortValue: (e) => e.amount,
        render: (e) => (
          <span className="font-semibold text-text-primary">
            {money(e.amount)}
          </span>
        ),
      },
      {
        key: "method",
        header: "Cách trả",
        secondary: true,
        sortValue: (e) => PAYMENT_METHOD_LABEL[e.payment_method] || "",
        render: (e) => (
          <span className="text-text-secondary">
            {PAYMENT_METHOD_LABEL[e.payment_method]}
          </span>
        ),
      },
      {
        key: "account",
        header: "Tài khoản",
        secondary: true,
        sortValue: (e) =>
          e.bank_account_id ? accountById.get(e.bank_account_id)?.name || "" : "",
        render: (e) => (
          <span className="text-text-secondary">
            {e.bank_account_id && accountById.get(e.bank_account_id)
              ? accountById.get(e.bank_account_id)!.name
              : "—"}
          </span>
        ),
      },
      {
        key: "note",
        header: "Ghi chú",
        sortValue: (e) => e.note || "",
        render: (e) => (
          <span className="text-text-secondary">{display(e.note)}</span>
        ),
      },
      {
        key: "creator",
        header: "Người tạo",
        secondary: true,
        sortValue: (e) => e.created_by_name || "",
        render: (e) => (
          <span className="text-text-secondary">{display(e.created_by_name)}</span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        sortValue: (e) => (e.status === "ACTIVE" ? "Đang dùng" : "Đã huỷ"),
        render: (e) =>
          e.status === "ACTIVE" ? (
            <Badge variant="success">Đang dùng</Badge>
          ) : (
            <Badge variant="neutral">Đã huỷ</Badge>
          ),
      },
    ],
    [categoryById, accountById],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  // Default sort is Ngày, newest first
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "date");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (status === "ALL") return true;
      if (status === "ACTIVE") return entry.status === "ACTIVE";
      return entry.status === "CANCELLED";
    });
  }, [entries, status]);

  const sortedEntries = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredEntries, col.sortValue, sortDir)
      : filteredEntries;
  }, [filteredEntries, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedEntries, page);
  }, [sortedEntries, page]);

  const currentListUrl = listUrl(range, status, slice.page, sortParam, dirParam);

  const handleDateRangeChange = (nextRange: DateRangeValue) => {
    setRange(nextRange);
    setPage(1);
    router.replace(
      listUrl(nextRange, status, 1, sortParam, dirParam),
      { scroll: false },
    );
  };

  const handleApplyStatus = () => {
    setPage(1);
    router.replace(
      listUrl(range, status, 1, sortParam, dirParam),
      { scroll: false },
    );
  };

  const handleClearFilter = () => {
    setStatus("ACTIVE");
    setPage(1);
    router.replace(
      listUrl(range, "ACTIVE", 1, sortParam, dirParam),
      { scroll: false },
    );
  };

  const renderCard = (entry: DBCashEntry) => {
    const category = categoryById.get(entry.category_id);
    const account = entry.bank_account_id ? accountById.get(entry.bank_account_id) : undefined;
    const isCancelled = entry.status === "CANCELLED";

    return (
      <div className={`flex flex-col gap-2 ${isCancelled ? "opacity-60" : ""}`}>
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="font-bold text-text-primary text-base leading-tight">
              {category?.name ?? "—"}
            </div>
            <div className="text-[11px] text-text-muted mt-0.5 font-mono">
              {entry.id} · {formatDate(entry.entry_date)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="font-bold text-text-primary">
              {money(entry.amount)}
            </span>
            {entry.status === "ACTIVE" ? (
              <Badge variant="success">Đang dùng</Badge>
            ) : (
              <Badge variant="neutral">Đã huỷ</Badge>
            )}
          </div>
        </div>
        <div className="text-xs text-text-secondary pt-1 border-t border-border/50 flex flex-col gap-1">
          <div className="flex justify-between">
            <span className="text-text-muted">Bên:</span>
            <span>{category ? KIND_LABEL[category.kind] : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Cách trả:</span>
            <span>{PAYMENT_METHOD_LABEL[entry.payment_method]}</span>
          </div>
          {account && (
            <div className="flex justify-between">
              <span className="text-text-muted">Tài khoản:</span>
              <span>{account.name}</span>
            </div>
          )}
          {entry.note && (
            <div className="flex justify-between">
              <span className="text-text-muted">Ghi chú:</span>
              <span className="truncate max-w-[200px]">{entry.note}</span>
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
          confirmMessage: (count: number) =>
            `Huỷ ${count} dòng sổ? Dòng vẫn hiện trong sổ nhưng không tính vào tổng nữa.`,
          remove: async (id: string) => {
            const fd = new FormData();
            fd.set("id", id);
            const res = await cancelCashEntry(fd);
            if (res?.error) {
              return { error: res.error };
            }
            return {};
          },
        }
      : undefined;

  return (
    <div className="space-y-6">
      {/* 1. FilterCard */}
      <FilterCard
        onApply={handleApplyStatus}
        onClear={handleClearFilter}
        showClear={status !== "ACTIVE"}
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
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-48">
          <label
            htmlFor="cashbook-status"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Trạng thái
          </label>
          <select
            id="cashbook-status"
            value={status}
            onChange={(e) => setStatus(parseStatus(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ACTIVE">Đang dùng</option>
            <option value="CANCELLED">Đã huỷ</option>
            <option value="ALL">Tất cả</option>
          </select>
        </div>
      </FilterCard>

      {/* 2. Totals block */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm">
            <div className="text-sm text-text-muted">Tổng chi</div>
            <div data-testid="total-expense" className="text-xl font-bold text-danger mt-1">
              {money(summary.totalExpense)}
            </div>
          </div>
          <div data-testid="total-income" className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm">
            <div className="text-sm text-text-muted">Tổng thu</div>
            <div className="text-xl font-bold text-success mt-1">
              {money(summary.totalIncome)}
            </div>
            <div className="text-xs text-text-muted mt-2 pt-2 border-t border-border">
              Trong đó thu ngoài lãi lỗ (vốn góp, ...):{" "}
              <span data-testid="income-outside-pnl" className="font-medium text-text-primary">
                {money(summary.incomeOutsidePnl)}
              </span>
            </div>
          </div>
        </div>

        {(summary.byCategory.length > 0 || summary.unknownCategoryIds.length > 0) && (
          <div data-testid="by-category" className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm">
            <div className="text-sm text-text-muted mb-2">Theo nhóm</div>
            <div className="space-y-1 text-sm">
              {summary.byCategory.map((c) => (
                <div key={c.categoryId} className="flex justify-between text-text-primary">
                  <span>{c.name}</span>
                  <span className="font-medium">{money(c.total)}</span>
                </div>
              ))}
              {summary.unknownCategoryIds.length > 0 && (
                <div className="text-danger">Có dòng thuộc nhóm không còn trong danh sách</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. DataList */}
      <DataList
        rows={slice.rows}
        getId={(e) => e.id}
        getName={(e) => {
          const cat = categoryById.get(e.category_id);
          return `${cat?.name ?? e.id} (${money(e.amount)})`;
        }}
        getHref={(e) =>
          `/admin/finance/${encodeURIComponent(e.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={renderCard}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) =>
            listUrl(range, status, 1, k, d),
        }}
        removal={removal}
        empty={
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
            <div className="text-text-secondary text-sm">
              Chưa có khoản nào trong khoảng này
            </div>
            {status !== "ACTIVE" && (
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
            pageHref={(p) => listUrl(range, status, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
