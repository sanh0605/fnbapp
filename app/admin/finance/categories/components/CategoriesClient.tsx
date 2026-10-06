"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { Badge } from "@/components/ui/Badge";
import { setCashCategoryStatus } from "@/app/admin/finance/categories/actions";
import type { DBCashCategory } from "@/types/db";

export interface CategoriesClientProps {
  categories: DBCashCategory[];
  canDelete?: boolean;
  initialSearch?: string;
  initialStatus?: string;
  initialPage?: string;
}

const VALID_STATUSES = ["ACTIVE", "INACTIVE", "ALL"] as const;
type CategoryStatusFilter = (typeof VALID_STATUSES)[number];

function parseStatus(raw: string | null | undefined): CategoryStatusFilter {
  if (raw === "INACTIVE" || raw === "ALL") return raw;
  return "ACTIVE";
}

const KIND_LABEL: Record<DBCashCategory["kind"], string> = {
  EXPENSE: "Chi",
  INCOME: "Thu",
};

// BR-CASH-006: a category counted into profit and loss can also be marked
// sales revenue; the list names all three treatments a category can have.
export function pnlTreatmentLabel(
  category: Pick<DBCashCategory, "affects_pnl" | "is_sales_revenue">,
): string {
  if (!category.affects_pnl) return "Không";
  return category.is_sales_revenue === true ? "Có — doanh thu bán hàng" : "Có";
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
  return qs ? `/admin/finance/categories?${qs}` : "/admin/finance/categories";
}

export default function CategoriesClient({
  categories,
  initialSearch,
  initialStatus,
  initialPage,
}: CategoriesClientProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [search, setSearch] = useState(
    () => initialSearch ?? searchParams?.get("q") ?? "",
  );
  const [status, setStatus] = useState<CategoryStatusFilter>(() =>
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

  const columns: DataColumn<DBCashCategory>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (c) => c.id,
        render: (c) => (
          <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
            {c.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên",
        sortValue: (c) => c.name,
        render: (c) => (
          <div className="font-bold text-text-primary">{c.name}</div>
        ),
      },
      {
        key: "kind",
        header: "Bên",
        sortValue: (c) => KIND_LABEL[c.kind],
        render: (c) => (
          <span className="text-text-secondary">{KIND_LABEL[c.kind]}</span>
        ),
      },
      {
        key: "pnl",
        header: "Tính vào lãi lỗ",
        sortValue: (c) => pnlTreatmentLabel(c),
        render: (c) => (
          <span className="text-text-secondary">{pnlTreatmentLabel(c)}</span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        sortValue: (c) => (c.status === "ACTIVE" ? "Đang dùng" : "Ngừng dùng"),
        render: (c) =>
          c.status === "ACTIVE" ? (
            <Badge variant="success">Đang dùng</Badge>
          ) : (
            <Badge variant="warning">Ngừng dùng</Badge>
          ),
      },
    ],
    [],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  // Default sort is code (id), descending
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return categories.filter((category) => {
      const matchStatus =
        status === "ALL" ||
        (status === "ACTIVE"
          ? category.status === "ACTIVE"
          : category.status !== "ACTIVE");
      if (!matchStatus) return false;

      if (q) {
        const matchName = (category.name || "").toLocaleLowerCase("vi").includes(q);
        const matchId = (category.id || "").toLocaleLowerCase("vi").includes(q);
        return matchName || matchId;
      }
      return true;
    });
  }, [categories, search, status]);

  const sortedCategories = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredCategories, col.sortValue, sortDir)
      : filteredCategories;
  }, [filteredCategories, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedCategories, page);
  }, [sortedCategories, page]);

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, status, 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const handleClearFilter = () => {
    setSearch("");
    setStatus("ACTIVE");
    setPage(1);
    router.replace(listUrl("", "ACTIVE", 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const currentListUrl = listUrl(search, status, slice.page, sortParam, dirParam);

  const renderCard = (category: DBCashCategory) => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-bold text-text-primary text-base leading-tight">
            {category.name}
          </div>
          <div className="text-[11px] text-text-muted mt-0.5 font-mono">
            {category.id}
          </div>
        </div>
        <div className="shrink-0">
          {category.status === "ACTIVE" ? (
            <Badge variant="success">Đang dùng</Badge>
          ) : (
            <Badge variant="warning">Ngừng dùng</Badge>
          )}
        </div>
      </div>
      <div className="text-xs text-text-secondary pt-1 border-t border-border/50 flex flex-col gap-1">
        <div className="flex justify-between">
          <span className="text-text-muted">Bên:</span>
          <span>{KIND_LABEL[category.kind]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Tính vào lãi lỗ:</span>
          <span>{pnlTreatmentLabel(category)}</span>
        </div>
      </div>
    </div>
  );

  const removal =
    status === "ACTIVE"
      ? {
          verb: "Ngừng dùng",
          confirmMessage: (count: number) =>
            `Ngừng dùng ${count} nhóm? Nhóm sẽ không còn hiện khi ghi khoản thu chi mới, nhưng các dòng đã ghi vẫn giữ nguyên.`,
          remove: async (id: string) => {
            const fd = new FormData();
            fd.set("id", id);
            fd.set("status", "INACTIVE");
            const res = await setCashCategoryStatus(fd);
            if (res?.error) {
              return { error: res.error };
            }
            return { deactivated: true };
          },
        }
      : undefined;

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Thu chi"
        title="Nhóm thu chi"
        action={
          <Link
            href={`/admin/finance/categories/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            Tạo
          </Link>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search || status !== "ACTIVE")}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-64">
          <label
            htmlFor="categories-search"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Tìm nhóm
          </label>
          <input
            id="categories-search"
            type="text"
            placeholder="Tên hoặc mã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-48">
          <label
            htmlFor="categories-status"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Trạng thái
          </label>
          <select
            id="categories-status"
            value={status}
            onChange={(e) => setStatus(parseStatus(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ACTIVE">Đang dùng</option>
            <option value="INACTIVE">Ngừng dùng</option>
            <option value="ALL">Tất cả</option>
          </select>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(c) => c.id}
        getName={(c) => c.name}
        getHref={(c) =>
          `/admin/finance/categories/${encodeURIComponent(c.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={renderCard}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, status, 1, k, d),
        }}
        removal={removal}
        empty={
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
            <div className="text-text-secondary text-sm">
              Không có nhóm thu chi nào khớp bộ lọc
            </div>
            {Boolean(search || status !== "ACTIVE") && (
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
            unit="nhóm"
            pageHref={(p) => listUrl(search, status, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
