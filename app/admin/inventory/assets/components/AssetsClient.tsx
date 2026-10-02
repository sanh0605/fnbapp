"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort, type SortDir } from "@/components/ui/list/sort";
import { formatNumber } from "@/lib/shared/format";
import { AssetCard } from "./AssetCard";
import type { AssetView } from "../actions";

interface AssetsClientProps {
  assets: AssetView[];
  activeTab?: string;
  initialPage?: string;
}

const BUCKET_LABEL: Record<AssetView["bucket"], string> = {
  IN_USE: "Còn dùng",
  FULLY_DEPRECIATED: "Đã hết khấu hao",
  DISPOSED: "Đã thanh lý",
};

const BUCKET_BADGE_CLASS: Record<AssetView["bucket"], string> = {
  IN_USE: "bg-primary-soft text-primary-active border-primary/20",
  FULLY_DEPRECIATED: "bg-warning/10 text-warning-active border-warning/20",
  DISPOSED: "bg-surface-secondary text-text-secondary border-border",
};

function listUrl(page: number = 1, tab?: string, sort?: string, dir?: string): string {
  const p = new URLSearchParams();
  if (tab) p.set("tab", tab);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/inventory/assets?${qs}` : "/admin/inventory/assets";
}

export default function AssetsClient({
  assets,
  activeTab,
  initialPage,
}: AssetsClientProps) {
  const searchParams = useSearchParams();
  const currentTab = searchParams?.get("tab") ?? activeTab;
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

  const columns: DataColumn<AssetView>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (asset) => asset.id,
        render: (asset) => (
          <span className="font-mono text-text-secondary">{asset.id}</span>
        ),
      },
      {
        key: "name",
        header: "Tên",
        sortValue: (asset) => asset.name,
        render: (asset) => (
          <span className="font-bold text-text-primary">{asset.name}</span>
        ),
      },
      {
        key: "acquiredDate",
        header: "Ngày mua",
        sortValue: (asset) => asset.acquiredDate,
        render: (asset) => {
          const [y, m, d] = asset.acquiredDate.split("-");
          const formatted = y && m && d ? `${d}/${m}/${y}` : asset.acquiredDate;
          return <span className="text-text-secondary">{formatted}</span>;
        },
      },
      {
        key: "quantity",
        header: "Số lượng còn",
        sortValue: (asset) => asset.remainingQuantity,
        render: (asset) => (
          <span className="text-text-primary">
            {asset.remainingQuantity} / {asset.quantity} cái
          </span>
        ),
      },
      {
        key: "unitCost",
        header: "Đơn giá",
        align: "right",
        secondary: true,
        sortValue: (asset) => asset.unitCost,
        render: (asset) => (
          <span className="text-text-secondary">
            {formatNumber(Math.round(asset.unitCost))}đ
          </span>
        ),
      },
      {
        key: "termMonths",
        header: "Thời hạn",
        secondary: true,
        sortValue: (asset) => asset.termMonths,
        render: (asset) => (
          <span className="text-text-secondary">{asset.termMonths} tháng</span>
        ),
      },
      {
        key: "remainingValue",
        header: "Giá trị còn lại",
        align: "right",
        sortValue: (asset) => asset.remainingValue,
        render: (asset) => (
          <span className="font-bold text-text-primary">
            {formatNumber(Math.round(asset.remainingValue))}đ
          </span>
        ),
      },
      {
        key: "bucket",
        header: "Trạng thái",
        sortValue: (asset) => BUCKET_LABEL[asset.bucket],
        render: (asset) => (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${BUCKET_BADGE_CLASS[asset.bucket]}`}
          >
            {BUCKET_LABEL[asset.bucket]}
          </span>
        ),
      },
    ],
    [],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");

  const sortedAssets = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue ? sortRows(assets, col.sortValue, sortDir) : assets;
  }, [assets, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedAssets, page, 20);
  }, [sortedAssets, page]);

  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;
  const currentListUrl = listUrl(slice.page, currentTab, sortParam, dirParam);

  return (
    <div className="space-y-4">
      <DataList
        rows={slice.rows}
        getId={(asset) => asset.id}
        getName={(asset) => asset.name}
        getHref={(asset) =>
          `/admin/inventory/assets/${encodeURIComponent(asset.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={(asset) => <AssetCard asset={asset} />}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(1, currentTab, k, d),
        }}
        empty={<EmptyState title="Không có tài sản nào ở mục này." />}
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="tài sản"
            pageHref={(p) => listUrl(p, currentTab, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}

