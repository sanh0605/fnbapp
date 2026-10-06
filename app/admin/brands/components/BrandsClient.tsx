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
import { formatDate } from "@/lib/shared/datetime";
import { deleteBrand } from "@/app/admin/brands/actions";
import type { DBBrand } from "@/types/db";

interface BrandsClientProps {
  brands: DBBrand[];
  // ADMIN only (BR-ACCESS-003) -- everyone else may add and edit.
  canDelete: boolean;
  initialSearch?: string;
  initialPage?: string;
}

function listUrl(
  search: string,
  page: number = 1,
  sort?: string,
  dir?: string,
): string {
  const p = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed) p.set("q", trimmed);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/brands?${qs}` : "/admin/brands";
}

export default function BrandsClient({
  brands,
  canDelete,
  initialSearch,
  initialPage,
}: BrandsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [search, setSearch] = useState(
    () => initialSearch ?? searchParams?.get("q") ?? "",
  );
  const [page, setPage] = useState<string | number | undefined>(
    () => initialPage ?? searchParams?.get("page") ?? undefined,
  );

  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
    else if (searchParams?.get("q") !== null) setSearch(searchParams?.get("q") || "");
  }, [initialSearch, searchParams]);

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage);
    else if (searchParams?.get("page") !== null)
      setPage(searchParams?.get("page") || undefined);
  }, [initialPage, searchParams]);

  const columns: DataColumn<DBBrand>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (b) => b.id,
        render: (b) => (
          <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
            {b.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên thương hiệu",
        sortValue: (b) => b.name,
        render: (b) => (
          <div className="font-bold text-text-primary">{b.name}</div>
        ),
      },
      {
        key: "code",
        header: "Mã đơn hàng",
        sortValue: (b) => b.code || "",
        render: (b) => (
          <span className="font-mono text-primary font-bold">
            {b.code || "—"}
          </span>
        ),
      },
      {
        key: "start_date",
        header: "Ngày bắt đầu",
        sortValue: (b) => b.start_date || "",
        render: (b) => (
          <span className="text-text-secondary text-sm">
            {b.start_date ? formatDate(b.start_date) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return brands.filter((brand) => {
      if (!q) return true;
      const matchName = (brand.name || "").toLocaleLowerCase("vi").includes(q);
      const matchCode = (brand.code || "").toLocaleLowerCase("vi").includes(q);
      const matchId = (brand.id || "").toLocaleLowerCase("vi").includes(q);
      return matchName || matchCode || matchId;
    });
  }, [brands, search]);

  const sortedBrands = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredBrands, col.sortValue, sortDir)
      : filteredBrands;
  }, [filteredBrands, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedBrands, page);
  }, [sortedBrands, page]);

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const handleClearFilter = () => {
    setSearch("");
    setPage(1);
    router.replace(listUrl("", 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const currentListUrl = listUrl(search, slice.page, sortParam, dirParam);

  const renderCard = (brand: DBBrand) => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-bold text-text-primary text-base leading-tight">
            {brand.name}
          </div>
          <div className="font-mono text-[11px] text-text-muted mt-0.5 font-bold">
            {brand.id}
          </div>
        </div>
        {brand.code && (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary-soft text-primary border border-primary/20 font-mono">
            {brand.code}
          </span>
        )}
      </div>
      {brand.start_date && (
        <div className="text-xs text-text-secondary pt-1 border-t border-border/50">
          <span className="text-text-muted">Ngày bắt đầu: </span>
          <span>{formatDate(brand.start_date)}</span>
        </div>
      )}
    </div>
  );

  const removal = canDelete
    ? {
        verb: "Xoá",
        confirmMessage: (count: number) => `Xoá ${count} thương hiệu?`,
        remove: async (id: string) => {
          const fd = new FormData();
          fd.append("id", id);
          const res = await deleteBrand(fd);
          if (res?.error) {
            return { error: res.error };
          }
          return {};
        },
      }
    : undefined;

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Bán hàng"
        title="Thương hiệu"
        action={
          <Link
            href={`/admin/brands/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            Tạo
          </Link>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search)}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-64">
          <label
            htmlFor="brands-search"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Tìm thương hiệu
          </label>
          <input
            id="brands-search"
            type="text"
            placeholder="Tên, mã đơn hàng hoặc mã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          />
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(b) => b.id}
        getName={(b) => b.name}
        getHref={(b) =>
          `/admin/brands/${encodeURIComponent(b.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={renderCard}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, 1, k, d),
        }}
        removal={removal}
        empty={
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
            <div className="text-text-secondary text-sm">
              Không có thương hiệu nào khớp bộ lọc
            </div>
            <div>
              <button
                type="button"
                onClick={handleClearFilter}
                className="text-danger hover:underline font-medium text-sm min-h-[44px] inline-flex items-center"
              >
                Xoá lọc
              </button>
            </div>
          </div>
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="thương hiệu"
            pageHref={(p) => listUrl(search, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
