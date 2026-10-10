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
import { deleteCategory } from "@/app/admin/products/categories/actions";
import type { DBProductCategory } from "@/types/db";

interface CategoriesClientProps {
  categories: DBProductCategory[];
  counts: Record<string, number>;
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
  return qs ? `/admin/products/categories?${qs}` : "/admin/products/categories";
}

export default function CategoriesClient({
  categories,
  counts,
  initialSearch = "",
  initialPage,
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
          <div className="text-text-primary">{cat.name}</div>
        ),
      },
      {
        key: "count",
        header: "Số món",
        align: "right",
        sortValue: (cat) => counts[cat.id] ?? 0,
        render: (cat) => (
          <span className="text-text-secondary text-sm">
            {`${counts[cat.id] ?? 0} món`}
          </span>
        ),
      },
    ],
    [counts],
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

  const renderCard = (cat: DBProductCategory) => {
    const count = counts[cat.id] ?? 0;
    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="text-text-primary text-base leading-tight">
              {cat.name}
            </div>
            <div className="font-mono text-xs text-primary mt-0.5">
              {cat.id}
            </div>
          </div>
          <div className="shrink-0 text-text-secondary text-xs">
            {`${count} món`}
          </div>
        </div>
      </div>
    );
  };

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
        group="Món"
        title="Nhóm món"
        action={
          <Button
            href={`/admin/products/categories/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            variant="primary"
            className="w-full md:w-auto"
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
          <Field label="Tìm nhóm" htmlFor="categories-search">
            <TextInput
              id="categories-search"
              placeholder="Ví dụ: Cà phê"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(cat) => cat.id}
        getName={(cat) => cat.name}
        getHref={(cat) =>
          `/admin/products/categories/${encodeURIComponent(cat.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
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
