"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Alert } from "@/components/ui/Alert";
import { DateRangeButton } from "@/components/ui/DateRangeButton";
import { formatDate, formatVnDay } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { cancelCashEntry } from "@/app/admin/finance/actions";
import { cancelCashTransfer } from "@/app/admin/finance/transfers/actions";
import { cashBookRowTotals, type CashBookRow } from "@/lib/finance/cash-book-rows";
import type { CashBookSummary, Balance } from "@/lib/finance/cash-flow";
import { writeRangeParams, type RangeValue } from "@/lib/shared/date-range-params";

export interface CashBookClientProps {
  rows: CashBookRow[];
  summary: CashBookSummary;
  today: string;
  resolvedRange: RangeValue;
  initialSearch?: string;
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
  range: RangeValue,
  kind: CashBookKindFilter,
  status: CashEntryStatusFilter,
  page: number = 1,
  sort?: string,
  dir?: string,
  search?: string,
): string {
  const p = new URLSearchParams();
  writeRangeParams(p, range);
  if (search && search.trim()) p.set("q", search.trim());
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
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-sm font-semibold text-text-primary">{title}</div>
        <div className="text-xs text-text-muted">cả sổ, mọi loại</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-xs text-text-muted">Tiền mặt (theo sổ)</div>
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
      {balance.cash < 0 && (
        <Alert variant="warning">
          sổ chưa ghi tiền gửi ngân hàng
        </Alert>
      )}
    </div>
  );
}

export default function CashBookClient({
  rows,
  summary,
  today,
  resolvedRange,
  initialSearch,
  initialKind,
  initialStatus,
  initialPage,
}: CashBookClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [range, setRange] = useState<RangeValue>(() => resolvedRange);

  const [search, setSearch] = useState<string>(
    () => initialSearch ?? searchParams?.get("q") ?? "",
  );

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
    setRange(resolvedRange);
  }, [resolvedRange.preset, resolvedRange.start, resolvedRange.end]);

  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
    else if (searchParams?.get("q") !== null)
      setSearch(searchParams?.get("q") || "");
  }, [initialSearch, searchParams]);

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
            <span className="font-mono text-xs text-primary transition-colors">
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
          <div>
            <span className="text-text-primary">
              {r.groupLabel}
            </span>
            {r.monthlyItemName && (
              <div className="text-xs text-text-muted">
                Khoản chi hằng tháng: {r.monthlyItemName}
              </div>
            )}
          </div>
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
          <span className="tabular-nums text-text-primary">
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
    const q = search.trim().toLocaleLowerCase("vi");
    return rows.filter((row) => {
      if (kind !== "ALL" && row.kind !== kind) return false;
      if (status === "ACTIVE" && row.status !== "ACTIVE") return false;
      if (status === "CANCELLED" && row.status !== "CANCELLED") return false;
      if (q) {
        const matchId = (row.id || "").toLocaleLowerCase("vi").includes(q);
        const matchGroup = (row.groupLabel || "").toLocaleLowerCase("vi").includes(q);
        const matchNote = (row.note || "").toLocaleLowerCase("vi").includes(q);
        const matchAccount = (row.accountLabel || "").toLocaleLowerCase("vi").includes(q);
        const matchCreator = (row.creator || "").toLocaleLowerCase("vi").includes(q);
        const matchMonthly = row.monthlyItemName
          ? String(row.monthlyItemName).toLocaleLowerCase("vi").includes(q)
          : false;
        return matchId || matchGroup || matchNote || matchAccount || matchCreator || matchMonthly;
      }
      return true;
    });
  }, [rows, kind, status, search]);

  const rowTotals = useMemo(() => cashBookRowTotals(filteredRows), [filteredRows]);

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
    search,
  );

  const handleDateRangeChange = (nextRange: RangeValue) => {
    setRange(nextRange);
    setPage(1);
    router.replace(listUrl(nextRange, kind, status, 1, sortParam, dirParam, search), {
      scroll: false,
    });
  };

  const handleApplyFilters = () => {
    setPage(1);
    router.replace(listUrl(range, kind, status, 1, sortParam, dirParam, search), {
      scroll: false,
    });
  };

  const handleClearFilter = () => {
    setSearch("");
    setKind("ALL");
    setStatus("ACTIVE");
    setPage(1);
    router.replace(listUrl(range, "ALL", "ACTIVE", 1, sortParam, dirParam, ""), {
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

  const appliedSearch = searchParams?.get("q") ?? initialSearch ?? "";
  const appliedKind = parseKind(searchParams?.get("kind") ?? initialKind);
  const appliedStatus = parseStatus(searchParams?.get("status") ?? initialStatus);

  const activeCount =
    (appliedSearch.trim() ? 1 : 0) +
    (appliedKind !== "ALL" ? 1 : 0) +
    (appliedStatus !== "ACTIVE" ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* 1. FilterCard */}
      <FilterCard
        onApply={handleApplyFilters}
        onClear={handleClearFilter}
        showClear={Boolean(search.trim() || status !== "ACTIVE" || kind !== "ALL")}
        activeCount={activeCount}
        search={
          <div className="flex-1 min-w-[200px]">
            <Field label="Tìm kiếm" htmlFor="cashbook-search">
              <TextInput
                id="cashbook-search"
                placeholder="Ví dụ: CE-001"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
        }
      >
        <div className="shrink-0 w-full md:w-auto">
          <label className="block text-sm font-medium text-text-primary mb-1">
            Thời gian
          </label>
          <DateRangeButton
            value={range}
            today={today}
            onChange={handleDateRangeChange}
          />
        </div>
        <div className="shrink-0 w-full md:w-44">
          <Field label="Loại" htmlFor="cashbook-kind">
            <Select
              id="cashbook-kind"
              value={kind}
              onChange={(e) => {
                const nextKind = parseKind(e.target.value);
                setKind(nextKind);
                setPage(1);
              }}
            >
              <option value="ALL">Tất cả</option>
              <option value="SALE">Bán hàng</option>
              <option value="PURCHASE">Nhập hàng</option>
              <option value="HAND">Ghi tay</option>
              <option value="TRANSFER">Chuyển tiền</option>
            </Select>
          </Field>
        </div>
        <div className="shrink-0 w-full md:w-44">
          <Field label="Trạng thái" htmlFor="cashbook-status">
            <Select
              id="cashbook-status"
              value={status}
              onChange={(e) => {
                const nextStatus = parseStatus(e.target.value);
                setStatus(nextStatus);
                setPage(1);
              }}
            >
              <option value="ACTIVE">Đang dùng</option>
              <option value="CANCELLED">Đã huỷ</option>
              <option value="ALL">Tất cả</option>
            </Select>
          </Field>
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
        phoneRow={(row) => {
          const isCancelled = row.status === "CANCELLED";
          const metaText = [
            formatDate(row.date),
            row.note && row.note !== "—" ? row.note : null,
            row.accountLabel && row.accountLabel !== "—" ? row.accountLabel : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return {
            title: isCancelled ? (
              <span className="opacity-60">{row.groupLabel}</span>
            ) : (
              row.groupLabel
            ),
            value: isCancelled ? (
              <span className="opacity-60">{money(row.amount)}</span>
            ) : (
              money(row.amount)
            ),
            meta: isCancelled ? (
              <span className="opacity-60">{metaText}</span>
            ) : (
              metaText
            ),
            badge: isCancelled ? (
              <Badge variant="neutral">Đã huỷ</Badge>
            ) : (
              <Badge
                variant={
                  row.sideLabel === "Thu"
                    ? "success"
                    : row.sideLabel === "Chi"
                      ? "danger"
                      : "neutral"
                }
              >
                {row.sideLabel}
              </Badge>
            ),
          };
        }}
        totals={{
          label: "Tổng (không tính huỷ, chuyển tiền)",
          values: {
            amount: `Thu ${formatNumber(rowTotals.income)}đ · Chi ${formatNumber(rowTotals.expense)}đ`,
          },
        }}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(range, kind, status, 1, k, d, search),
        }}
        removal={removal}
        empty={
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
            <div className="text-text-secondary text-sm">
              {rows.length === 0
                ? "Chưa có khoản nào trong khoảng này"
                : "Không có dòng nào khớp bộ lọc"}
            </div>
            {Boolean(search.trim() || status !== "ACTIVE" || kind !== "ALL") && (
              <div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClearFilter}
                >
                  Xoá lọc
                </Button>
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
            pageHref={(p) => listUrl(range, kind, status, p, sortParam, dirParam, search)}
          />
        </div>
      )}
    </div>
  );
}
