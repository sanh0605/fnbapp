"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { deleteAssetBand } from "../actions";
import { formatBandRange } from "@/lib/assets/asset-depreciation";
import type { DBAssetDepreciationBand } from "@/types/db";

interface BandsClientProps {
  bands: DBAssetDepreciationBand[];
  canDelete: boolean;
  initialPage?: string;
}

function listUrl(page: number = 1, sort?: string, dir?: string): string {
  const p = new URLSearchParams();
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/inventory/asset-bands?${qs}` : "/admin/inventory/asset-bands";
}

export default function BandsClient({
  bands,
  canDelete,
  initialPage,
}: BandsClientProps) {
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

  const columns: DataColumn<DBAssetDepreciationBand>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (band) => band.id,
        render: (band) => (
          <span className="font-mono font-bold text-text-primary">{band.id}</span>
        ),
      },
      {
        key: "range",
        header: "Đơn giá",
        sortValue: (band) => band.min_unit_price,
        render: (band) => (
          <span className="text-text-primary">{formatBandRange(band)}</span>
        ),
      },
      {
        key: "term",
        header: "Số tháng khấu hao",
        sortValue: (band) => band.term_months,
        render: (band) => (
          <span className="text-text-primary">{band.term_months} tháng</span>
        ),
      },
    ],
    [],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const sortedBands = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue ? sortRows(bands, col.sortValue, sortDir) : bands;
  }, [bands, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedBands, page);
  }, [sortedBands, page]);

  const currentListUrl = listUrl(slice.page, sortParam, dirParam);

  const renderCard = (band: DBAssetDepreciationBand) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-text-primary text-base">
          {band.id}
        </span>
        <span className="font-bold text-primary text-sm">
          {band.term_months} tháng
        </span>
      </div>
      <div className="text-sm text-text-muted">
        <span>Đơn giá: </span>
        <span className="text-text-primary">{formatBandRange(band)}</span>
      </div>
    </div>
  );

  const removal = canDelete
    ? {
        verb: "Xoá",
        confirmMessage: (count: number) => `Xoá ${count} khung khấu hao đã chọn?`,
        remove: async (id: string) => {
          const fd = new FormData();
          fd.append("id", id);
          const res = await deleteAssetBand(fd);
          if (res?.error) {
            return { error: res.error };
          }
          return {};
        },
      }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ListPageHeader
          group="Kho"
          title="Thời hạn khấu hao"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/inventory/assets"
                className="border border-border bg-surface-card text-text-primary px-4 py-2 rounded-lg font-medium hover:bg-surface-secondary transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm text-sm"
              >
                Tài sản
              </Link>
              <Link
                href={`/admin/inventory/asset-bands/new?returnTo=${encodeURIComponent(currentListUrl)}`}
                className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm text-sm"
              >
                Tạo
              </Link>
            </div>
          }
        />
        <p className="text-sm text-text-secondary">
          Xác định số tháng khấu hao theo đơn giá 1 cái. Sửa khung chỉ áp dụng cho tài sản mua sau đó.
        </p>
      </div>

      <DataList
        rows={slice.rows}
        getId={(band) => band.id}
        getName={() => ""}
        getHref={(band) =>
          `/admin/inventory/asset-bands/${encodeURIComponent(band.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
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
            title="Chưa có khung khấu hao nào."
          />
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="khung"
            pageHref={(p) => listUrl(p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
