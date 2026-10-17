"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { deleteUnit } from "@/app/admin/inventory/actions";
import type { DBUnit } from "@/types/db";

interface UnitsClientProps {
  units: DBUnit[];
  canDelete: boolean;
  initialPage?: string;
}

function listUrl(page: number = 1, sort?: string, dir?: string): string {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/inventory/units?${qs}` : "/admin/inventory/units";
}

export default function UnitsClient({
  units,
  canDelete,
  initialPage,
}: UnitsClientProps) {
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

  const columns: DataColumn<DBUnit>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Tên",
        sortValue: (unit) => unit.name,
        render: (unit) => (
          <span className="text-text-primary">{unit.name}</span>
        ),
      },
      {
        key: "description",
        header: "Ghi chú",
        sortValue: (unit) => unit.description || null,
        render: (unit) => (
          <span className="text-text-muted">{unit.description || "—"}</span>
        ),
      },
    ],
    [],
  );

  const validSortKeys = useMemo(
    () => ["id", ...columns.map((c) => c.key)],
    [columns],
  );
  const { key: parsedKey, dir: parsedDir } = parseSort(rawSort, rawDir, validSortKeys, "name");
  const sortKey = parsedKey;
  const sortDir = rawSort ? parsedDir : "asc";
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const sortedUnits = useMemo(() => {
    if (sortKey === "id") {
      return sortRows(units, (u) => u.id, sortDir);
    }
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue ? sortRows(units, col.sortValue, sortDir) : units;
  }, [units, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedUnits, page);
  }, [sortedUnits, page]);

  const currentListUrl = listUrl(slice.page, sortParam, dirParam);

  const removal = canDelete
    ? {
        verb: "Xoá",
        confirmMessage: (count: number) => `Xoá ${count} đơn vị đã chọn?`,
        remove: async (id: string) => {
          const fd = new FormData();
          fd.append("id", id);
          const res = await deleteUnit(fd);
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
        title="Đơn vị tính"
        action={
          <Button
            href={`/admin/inventory/units/new?returnTo=${encodeURIComponent(currentListUrl)}`}
          >
            Tạo
          </Button>
        }
      />

      <DataList
        rows={slice.rows}
        getId={(unit) => unit.id}
        getName={(unit) => unit.name}
        getHref={(unit) =>
          `/admin/inventory/units/${encodeURIComponent(unit.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        phoneRow={(unit) => ({
          title: unit.name,
          meta: unit.description || undefined,
        })}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(1, k, d),
        }}
        removal={removal}
        empty={
          <EmptyState
            icon="📏"
            title="Chưa có đơn vị nào"
            description="Thêm đơn vị tính để sử dụng trong hệ thống."
          />
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="đơn vị"
            pageHref={(p) => listUrl(p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
