"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { TextInput } from "@/components/ui/TextInput";
import { Field } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { formatNumber } from "@/lib/shared/format";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { AssetItemCard } from "./AssetItemCard";
import { assetItemTotals, type AssetItemRow } from "@/lib/assets/asset-items";

interface AssetsClientProps {
  items: AssetItemRow[];
  initialSearch?: string;
  initialAll?: boolean;
  initialPage?: string;
}

function listUrl(
  search: string,
  showAll: boolean,
  page: number = 1,
  sort?: string,
  dir?: string,
): string {
  const p = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed) p.set("q", trimmed);
  if (showAll) p.set("all", "1");
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/inventory/assets?${qs}` : "/admin/inventory/assets";
}

export default function AssetsClient({
  items,
  initialSearch,
  initialAll,
  initialPage,
}: AssetsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawQ = searchParams?.get("q");
  const rawAll = searchParams?.get("all");
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");
  const rawPage = searchParams?.get("page");

  const [search, setSearch] = useState(() => initialSearch ?? rawQ ?? "");
  const [showAll, setShowAll] = useState<boolean>(() =>
    initialAll !== undefined ? initialAll : rawAll === "1",
  );
  const [page, setPage] = useState<string | number | undefined>(
    () => initialPage ?? rawPage ?? undefined,
  );

  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
    else if (rawQ !== null && rawQ !== undefined) setSearch(rawQ);
  }, [initialSearch, rawQ]);

  useEffect(() => {
    if (initialAll !== undefined) setShowAll(initialAll);
    else setShowAll(rawAll === "1");
  }, [initialAll, rawAll]);

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage);
    else if (rawPage !== null && rawPage !== undefined) setPage(rawPage);
  }, [initialPage, rawPage]);

  const columns: DataColumn<AssetItemRow>[] = useMemo(
    () => [
      {
        key: "itemId",
        header: "Mã hàng",
        sortValue: (asset) => asset.itemId,
        render: (asset) => (
          <span className="font-mono text-primary">{asset.itemId}</span>
        ),
      },
      {
        key: "name",
        header: "Tên",
        sortValue: (asset) => asset.name,
        render: (asset) => (
          <div className="flex items-center gap-2">
            <span className="text-text-primary">{asset.name}</span>
            {asset.fullyDisposed && (
              <Badge variant="neutral">
                Đã thanh lý hết
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "quantity",
        header: "Còn / Đã mua",
        sortValue: (asset) => asset.remainingQuantity,
        render: (asset) => (
          <span className="text-text-primary">
            {asset.remainingQuantity} / {asset.quantity} cái
          </span>
        ),
      },
      {
        key: "disposedQuantity",
        header: "Đã thanh lý",
        secondary: true,
        sortValue: (asset) => asset.disposedQuantity,
        render: (asset) => (
          <span className="text-text-secondary">
            {asset.disposedQuantity > 0 ? `${asset.disposedQuantity} cái` : "—"}
          </span>
        ),
      },
      {
        key: "remainingValue",
        header: "Giá trị còn lại",
        align: "right",
        sortValue: (asset) => asset.remainingValue,
        render: (asset) => (
          <span className="text-text-primary">
            {formatNumber(Math.round(asset.remainingValue))}đ
          </span>
        ),
      },
      {
        key: "latestAcquiredDate",
        header: "Mua gần nhất",
        secondary: true,
        sortValue: (asset) => asset.latestAcquiredDate,
        render: (asset) => (
          <span className="text-text-secondary">
            {formatDateTimeFull(asset.latestAcquiredDate)}
          </span>
        ),
      },
    ],
    [],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "itemId");

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return items.filter((asset) => {
      if (!showAll && asset.fullyDisposed) return false;
      if (q) {
        const matchName = asset.name.toLocaleLowerCase("vi").includes(q);
        const matchId = asset.itemId.toLocaleLowerCase("vi").includes(q);
        return matchName || matchId;
      }
      return true;
    });
  }, [items, search, showAll]);

  const assetTotals = useMemo(() => assetItemTotals(filteredAssets), [filteredAssets]);

  const sortedAssets = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue ? sortRows(filteredAssets, col.sortValue, sortDir) : filteredAssets;
  }, [filteredAssets, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedAssets, page, 20);
  }, [sortedAssets, page]);

  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;
  const currentListUrl = listUrl(search, showAll, slice.page, sortParam, dirParam);

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, showAll, 1, sortParam, dirParam), { scroll: false });
  };

  const handleClearFilter = () => {
    setSearch("");
    setShowAll(false);
    setPage(1);
    router.replace(listUrl("", false, 1, sortParam, dirParam), { scroll: false });
  };

  return (
    <div className="space-y-4">
      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search.trim() || showAll)}
      >
        <div className="shrink-0 w-full md:w-64">
          <Field label="Tìm kiếm" htmlFor="assets-search">
            <TextInput
              id="assets-search"
              type="text"
              placeholder="Ví dụ: Tạp dề"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </div>
        <div className="shrink-0 flex items-center h-10 mt-auto pb-1">
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-primary select-none">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <span>Hiện cả tài sản đã thanh lý hết</span>
          </label>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(asset) => asset.itemId}
        getName={(asset) => asset.name}
        getHref={(asset) =>
          `/admin/inventory/assets/${encodeURIComponent(asset.itemId)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={(asset) => <AssetItemCard item={asset} />}
        totals={{
          label: "Tổng (không tính đã thanh lý hết)",
          values: { remainingValue: formatNumber(assetTotals.remainingValue) },
        }}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, showAll, 1, k, d),
        }}
        empty={<EmptyState title="Không có tài sản nào khớp bộ lọc." />}
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="tài sản"
            pageHref={(p) => listUrl(search, showAll, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
