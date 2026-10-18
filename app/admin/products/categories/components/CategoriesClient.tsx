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
import { formatNumber } from "@/lib/shared/format";
import { deleteCategory } from "@/app/admin/products/categories/actions";
import type { DBProductCategory, DBProductType } from "@/types/db";

interface CategoriesClientProps {
  categories: DBProductCategory[];
  counts: Record<string, number>;
  types?: DBProductType[];
  initialSearch?: string;
  initialPage?: string;
  canDelete?: boolean;
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
  return qs ? `/admin/products/categories?${qs}` : "/admin/products/categories";
}

export default function CategoriesClient({
  categories,
  counts,
  types = [],
  initialSearch = "",
  initialPage,
  canDelete = false,
}: CategoriesClientProps) {
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

  const typesById = useMemo(
    () => new Map(types.map((t) => [t.id, t.name])),
    [types],
  );

  const columns: DataColumn<DBProductCategory>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (cat) => cat.id,
        render: (cat) => (
          <span className="font-mono text-xs text-primary">
            {cat.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên nhóm",
        sortValue: (cat) => cat.name,
        render: (cat) => (
          <div className="text-text-primary">
            {cat.icon ? <span className="mr-1.5">{cat.icon}</span> : null}
            {cat.name}
          </div>
        ),
      },
      {
        key: "type",
        header: "Loại món",
        sortValue: (cat) => typesById.get(cat.type_id) ?? "",
        render: (cat) => (
          <span className="text-text-secondary text-sm">
            {typesById.get(cat.type_id) || "—"}
          </span>
        ),
      },
      {
        key: "count",
        header: "Số món",
        align: "right",
        sortValue: (cat) => counts[cat.id] ?? 0,
        render: (cat) => (
          <span className="text-text-secondary text-sm tabular-nums">
            {`${formatNumber(counts[cat.id] ?? 0)} món`}
          </span>
        ),
      },
    ],
    [counts, typesById],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return categories.filter((cat) => {
      if (!q) return true;
      const matchName = (cat.name || "").toLocaleLowerCase("vi").includes(q);
      const matchId = (cat.id || "").toLocaleLowerCase("vi").includes(q);
      return matchName || matchId;
    });
  }, [categories, search]);

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

  const removal = {
    verb: "Xoá",
    confirmMessage: (count: number) => `Xoá ${count} nhóm món?`,
    remove: async (id: string) => {
      const fd = new FormData();
      fd.append("id", id);
      const res = await deleteCategory(fd);
      if (res?.error) {
        return { error: res.error };
      }
      return {};
    },
  };

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Bán hàng"
        title="Nhóm món"
        action={
          <Button
            href={`/admin/products/categories/new?returnTo=${encodeURIComponent(currentListUrl)}`}
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
        search={
          <div className="shrink-0 w-full md:w-64">
            <Field label="Tìm nhóm" htmlFor="categories-search">
              <TextInput
                id="categories-search"
                placeholder="Ví dụ: Cà phê"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
        }
      >
        {null}
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(cat) => cat.id}
        getName={(cat) => cat.name}
        getHref={(cat) =>
          `/admin/products/categories/${encodeURIComponent(cat.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        phoneRow={(cat) => {
          const typeName = typesById.get(cat.type_id);
          const showType =
            typeName &&
            cat.name.trim().toLowerCase() !== typeName.trim().toLowerCase();
          return {
            title: (
              <>
                {cat.icon ? <span className="mr-1.5">{cat.icon}</span> : null}
                {cat.name}
              </>
            ),
            value: `${formatNumber(counts[cat.id] ?? 0)} món`,
            meta: [cat.id, showType ? typeName : null]
              .filter(Boolean)
              .join(" · "),
          };
        }}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, 1, k, d),
        }}
        removal={canDelete ? removal : undefined}
        empty={
          <EmptyState
            icon="📂"
            title="Chưa có nhóm món nào"
            description="Thêm nhóm món để phân loại các món ăn/đồ uống."
          />
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="nhóm món"
            pageHref={(p) => listUrl(search, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
