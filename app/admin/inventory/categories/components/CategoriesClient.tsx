"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { deleteItemCategory } from "@/app/admin/inventory/actions";
import type { DBItemCategory } from "@/types/db";

interface CategoriesClientProps {
  categories: DBItemCategory[];
  canDelete: boolean;
  initialPage?: string;
}

function listUrl(page: number = 1, sort?: string, dir?: string): string {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/inventory/categories?${qs}` : "/admin/inventory/categories";
}

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  RAW: "Nguyên liệu",
  CONSUMABLE: "Vật tư",
  EQUIPMENT: "Dụng cụ",
};

function getTypeLabel(type: string) {
  switch (type) {
    case "RAW":
      return <Badge variant="processing">Nguyên liệu</Badge>;
    case "CONSUMABLE":
      return <Badge variant="warning">Vật tư</Badge>;
    case "EQUIPMENT":
      return <Badge variant="neutral">Dụng cụ</Badge>;
    default:
      return type;
  }
}

export default function CategoriesClient({
  categories,
  canDelete,
  initialPage,
}: CategoriesClientProps) {
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [page, setPage] = useState<string | number | undefined>(
    () => initialPage ?? searchParams?.get("page") ?? undefined,
  );

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage);
    else if (searchParams?.get("page") !== null)
      setPage(searchParams?.get("page") || undefined);
  }, [initialPage, searchParams]);

  const columns: DataColumn<DBItemCategory>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (cat) => cat.id,
        render: (cat) => (
          <span className="font-mono text-xs text-text-muted group-hover:text-primary transition-colors">
            {cat.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên",
        sortValue: (cat) => cat.name,
        render: (cat) => (
          <div className="text-text-primary">{cat.name}</div>
        ),
      },
      {
        key: "system_type",
        header: "Đặc tính",
        sortValue: (cat) => SYSTEM_TYPE_LABELS[cat.system_type] || cat.system_type,
        render: (cat) => getTypeLabel(cat.system_type),
      },
    ],
    [],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const sortedCategories = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue ? sortRows(categories, col.sortValue, sortDir) : categories;
  }, [categories, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedCategories, page);
  }, [sortedCategories, page]);

  const currentListUrl = listUrl(slice.page, sortParam, dirParam);

  const removal = canDelete
    ? {
        verb: "Xoá",
        confirmMessage: (count: number) => `Xoá ${count} phân loại đã chọn?`,
        remove: async (id: string) => {
          const fd = new FormData();
          fd.append("id", id);
          const res = await deleteItemCategory(fd);
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
        group="Kho"
        title="Phân loại hàng"
        action={
          <Button
            href={`/admin/inventory/categories/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            variant="primary"
          >
            Tạo
          </Button>
        }
      />

      <DataList
        rows={slice.rows}
        getId={(cat) => cat.id}
        getName={(cat) => cat.name}
        getHref={(cat) =>
          `/admin/inventory/categories/${encodeURIComponent(cat.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        phoneRow={(cat) => ({
          title: cat.name,
          meta: cat.id,
          badge: getTypeLabel(cat.system_type),
        })}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(1, k, d),
        }}
        removal={removal}
        empty={
          <EmptyState
            icon="📂"
            title="Chưa có danh mục"
            description="Thêm danh mục để phân loại hàng hoá."
          />
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="phân loại"
            pageHref={(p) => listUrl(p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
