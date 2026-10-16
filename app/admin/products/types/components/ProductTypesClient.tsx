"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import type { ProductTypeRow } from "@/app/admin/products/types/actions";

export interface ProductTypesClientProps {
  rows: ProductTypeRow[];
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
  return qs ? `/admin/products/types?${qs}` : "/admin/products/types";
}

export default function ProductTypesClient({
  rows,
  initialSearch = "",
  initialPage,
}: ProductTypesClientProps) {
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

  const columns: DataColumn<ProductTypeRow>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (r) => r.type.id,
        render: (r) => (
          <span className="font-mono text-xs text-primary font-normal">
            {r.type.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên loại",
        sortValue: (r) => r.type.name,
        render: (r) => (
          <div className="text-text-primary font-normal">{r.type.name}</div>
        ),
      },
      {
        key: "is_drink",
        header: "Tính là ly",
        sortValue: (r) => (r.type.is_drink ? "Có" : "Không"),
        render: (r) => (
          <span className="text-text-secondary font-normal">
            {r.type.is_drink ? "Có" : "Không"}
          </span>
        ),
      },
      {
        key: "categoryNames",
        header: "Nhóm món đang dùng",
        sortValue: (r) => r.categoryNames.join(", "),
        render: (r) => (
          <span className="text-text-secondary font-normal">
            {r.categoryNames.length > 0
              ? r.categoryNames.join(", ")
              : "Chưa có nhóm nào"}
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

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return rows.filter((r) => {
      if (!q) return true;
      const matchName = (r.type.name || "").toLocaleLowerCase("vi").includes(q);
      const matchId = (r.type.id || "").toLocaleLowerCase("vi").includes(q);
      const matchGroups = r.categoryNames.some((n) =>
        n.toLocaleLowerCase("vi").includes(q),
      );
      return matchName || matchId || matchGroups;
    });
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredRows, col.sortValue, sortDir)
      : filteredRows;
  }, [filteredRows, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedRows, page);
  }, [sortedRows, page]);

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

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Món"
        title="Loại món"
        action={
          <Button
            href={`/admin/products/types/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            variant="primary"
          >
            Tạo
          </Button>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search)}
      >
        <div className="shrink-0 w-full md:w-64">
          <Field label="Tìm loại món" htmlFor="types-search">
            <TextInput
              id="types-search"
              placeholder="Ví dụ: Thức uống"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(r) => r.type.id}
        getName={(r) => r.type.name}
        getHref={(r) =>
          `/admin/products/types/${encodeURIComponent(r.type.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        phoneRow={(r) => ({
          title: r.type.name,
          meta: [
            r.type.id,
            `Tính là ly: ${r.type.is_drink ? "Có" : "Không"}`,
            r.categoryNames.length > 0
              ? r.categoryNames.join(", ")
              : "Chưa có nhóm nào",
          ].join(" · "),
        })}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, 1, k, d),
        }}
        empty={
          <EmptyState
            icon="📂"
            title="Chưa có loại món nào"
            description="Thêm loại món để phân loại các nhóm món."
          />
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="loại món"
            pageHref={(p) => listUrl(search, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
