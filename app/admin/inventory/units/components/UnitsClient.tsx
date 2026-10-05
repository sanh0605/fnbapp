"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
          <span className="font-bold text-text-primary">{unit.name}</span>
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
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
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

  const renderCard = (unit: DBUnit) => (
    <div className="flex flex-col gap-1">
      <div className="font-bold text-text-primary text-base leading-tight">
        {unit.name}
      </div>
      <div className="text-sm text-text-muted">
        <span className="text-text-muted">Ghi chú:</span> {unit.description || "—"}
      </div>
    </div>
  );

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
          <Link
            href={`/admin/inventory/units/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            + Thêm Đơn vị
          </Link>
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
        renderCard={renderCard}
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
