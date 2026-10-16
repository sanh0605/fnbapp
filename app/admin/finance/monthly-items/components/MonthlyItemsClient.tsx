"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { formatNumber } from "@/lib/shared/format";
import type { MonthlyItemRow } from "../actions";
import type { DBCashCategory } from "@/types/db";

export interface MonthlyItemsClientProps {
  items: MonthlyItemRow[];
  categories: DBCashCategory[];
  initialSearch?: string;
  initialStatus?: string;
  initialPage?: string;
}

const VALID_STATUSES = ["ACTIVE", "INACTIVE", "ALL"] as const;
type MonthlyItemStatusFilter = (typeof VALID_STATUSES)[number];

function parseStatus(raw: string | null | undefined): MonthlyItemStatusFilter {
  if (raw === "INACTIVE" || raw === "ALL") return raw;
  return "ACTIVE";
}

function listUrl(
  search: string,
  status: string,
  page: number = 1,
  sort?: string,
  dir?: string,
): string {
  const p = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed) p.set("q", trimmed);
  if (status && status !== "ACTIVE") p.set("status", status);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/finance/monthly-items?${qs}` : "/admin/finance/monthly-items";
}

export default function MonthlyItemsClient({
  items,
  categories,
  initialSearch,
  initialStatus,
  initialPage,
}: MonthlyItemsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [search, setSearch] = useState(
    () => initialSearch ?? searchParams?.get("q") ?? "",
  );
  const [status, setStatus] = useState<MonthlyItemStatusFilter>(() =>
    parseStatus(initialStatus ?? searchParams?.get("status")),
  );
  const [page, setPage] = useState<string | number | undefined>(
    () => initialPage ?? searchParams?.get("page") ?? undefined,
  );

  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
    else if (searchParams?.get("q") !== null)
      setSearch(searchParams?.get("q") || "");
  }, [initialSearch, searchParams]);

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

  const categoryMap = useMemo(() => {
    const map = new Map<string, DBCashCategory>();
    for (const c of categories) {
      map.set(c.id, c);
    }
    return map;
  }, [categories]);

  const columns: DataColumn<MonthlyItemRow>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (r) => r.item.id,
        render: (r) => (
          <span className="font-mono text-xs text-primary transition-colors">
            {r.item.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên khoản",
        sortValue: (r) => r.item.name,
        render: (r) => (
          <div className="text-text-primary">{r.item.name}</div>
        ),
      },
      {
        key: "category",
        header: "Nhóm thu chi",
        sortValue: (r) => categoryMap.get(r.item.cash_category_id)?.name ?? "",
        render: (r) => (
          <span className="text-text-secondary">
            {categoryMap.get(r.item.cash_category_id)?.name ?? r.item.cash_category_id}
          </span>
        ),
      },
      {
        key: "entryCount",
        header: "Số dòng đã nhập",
        align: "right",
        sortValue: (r) => r.entryCount,
        render: (r) => (
          <span className="text-text-secondary tabular-nums">
            {formatNumber(r.entryCount)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        sortValue: (r) => (r.item.status === "ACTIVE" ? "Đang dùng" : "Ngừng dùng"),
        render: (r) =>
          r.item.status === "ACTIVE" ? (
            <Badge variant="success">Đang dùng</Badge>
          ) : (
            <Badge variant="warning">Ngừng dùng</Badge>
          ),
      },
    ],
    [categoryMap],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredItems = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return items.filter((row) => {
      const matchStatus =
        status === "ALL" ||
        (status === "ACTIVE"
          ? row.item.status === "ACTIVE"
          : row.item.status !== "ACTIVE");
      if (!matchStatus) return false;

      if (q) {
        const catName = categoryMap.get(row.item.cash_category_id)?.name || "";
        const matchName = (row.item.name || "").toLocaleLowerCase("vi").includes(q);
        const matchId = (row.item.id || "").toLocaleLowerCase("vi").includes(q);
        const matchCat = catName.toLocaleLowerCase("vi").includes(q);
        return matchName || matchId || matchCat;
      }
      return true;
    });
  }, [items, search, status, categoryMap]);

  const sortedItems = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredItems, col.sortValue, sortDir)
      : filteredItems;
  }, [filteredItems, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedItems, page);
  }, [sortedItems, page]);

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, status, 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const hasAnyFilter = Boolean(search || status !== "ACTIVE");

  const handleClearFilter = () => {
    setSearch("");
    setStatus("ACTIVE");
    setPage(1);
    router.replace(listUrl("", "ACTIVE", 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const currentListUrl = listUrl(search, status, slice.page, sortParam, dirParam);

  const appliedSearch = searchParams?.get("q") ?? initialSearch ?? "";
  const appliedStatus = parseStatus(searchParams?.get("status") ?? initialStatus);

  const activeCount =
    (appliedSearch.trim() ? 1 : 0) +
    (appliedStatus !== "ACTIVE" ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <ListPageHeader
          group="Thu chi"
          title="Khoản chi hằng tháng"
          action={
            <Button
              href={`/admin/finance/monthly-items/new?returnTo=${encodeURIComponent(currentListUrl)}`}
              variant="primary"
            >
              Tạo
            </Button>
          }
        />
        <p className="text-sm text-text-secondary">
          Mỗi khoản được nhắc ở Tổng quan từ ngày bắt đầu nhắc của mỗi tháng cho tới khi có một dòng chi gắn khoản đó trong tháng.
        </p>
      </div>

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={hasAnyFilter}
        activeCount={activeCount}
        search={
          <Field label="Tìm khoản chi" htmlFor="monthly-items-search">
            <TextInput
              id="monthly-items-search"
              placeholder="Ví dụ: Tiền điện"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        }
      >
        <div className="shrink-0 w-full md:w-48">
          <Field label="Trạng thái" htmlFor="monthly-items-status">
            <Select
              id="monthly-items-status"
              value={status}
              onChange={(e) => setStatus(parseStatus(e.target.value))}
            >
              <option value="ACTIVE">Đang dùng</option>
              <option value="INACTIVE">Ngừng dùng</option>
              <option value="ALL">Tất cả</option>
            </Select>
          </Field>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(r) => r.item.id}
        getName={(r) => r.item.name}
        getHref={(r) =>
          `/admin/finance/monthly-items/${encodeURIComponent(r.item.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        phoneRow={(r) => ({
          title: r.item.name,
          value: `${formatNumber(r.entryCount)} dòng`,
          meta: categoryMap.get(r.item.cash_category_id)?.name ?? r.item.cash_category_id,
          badge:
            r.item.status === "ACTIVE" ? (
              <Badge variant="success">Đang dùng</Badge>
            ) : (
              <Badge variant="warning">Ngừng dùng</Badge>
            ),
        })}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, status, 1, k, d),
        }}
        empty={
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
            <div className="text-text-secondary text-sm">
              {hasAnyFilter
                ? "Không có khoản chi nào khớp bộ lọc"
                : "Chưa có khoản chi hằng tháng nào"}
            </div>
            {hasAnyFilter && (
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
            unit="khoản chi"
            pageHref={(p) => listUrl(search, status, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
