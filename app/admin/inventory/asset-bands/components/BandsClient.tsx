"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { formatBandRange } from "@/lib/assets/asset-depreciation";
import type { DBAssetDepreciationBand } from "@/types/db";

interface BandsClientProps {
  bands: DBAssetDepreciationBand[];
  canDelete?: boolean;
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
          <span className="font-mono text-text-primary">{band.id}</span>
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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <ListPageHeader
          group="Kho"
          title="Thời hạn khấu hao"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                href="/admin/inventory/assets"
                variant="secondary"
              >
                Tài sản
              </Button>
              <Button
                href={`/admin/inventory/asset-bands/edit?returnTo=${encodeURIComponent(currentListUrl)}`}
              >
                Sửa khung
              </Button>
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
        phoneRow={(band) => ({
          title: formatBandRange(band),
          value: `${band.term_months} tháng`,
          meta: band.id,
        })}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(1, k, d),
        }}
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
