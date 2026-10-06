"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { deleteConversionAction } from "../actions";
import type { DBUOMConversion, DBPurchasedItem, DBUnit } from "@/types/db";

interface ConversionsClientProps {
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
  usedConversionIds?: string[];
  canDelete: boolean;
  initialSearch?: string;
  initialPage?: string;
}

function listUrl(search: string, page: number = 1, sort?: string, dir?: string): string {
  const p = new URLSearchParams();
  if (search) p.set("q", search);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/inventory/conversions?${qs}` : "/admin/inventory/conversions";
}

export default function ConversionsClient({
  items,
  conversions,
  units,
  usedConversionIds = [],
  canDelete,
  initialSearch = "",
  initialPage,
}: ConversionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [search, setSearch] = useState(() => initialSearch ?? searchParams?.get("q") ?? "");
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

  const unitMap = useMemo(() => {
    const map: Record<string, string> = {};
    units.forEach((u) => (map[u.id] = u.name));
    return map;
  }, [units]);

  const itemMap = useMemo(() => {
    const map: Record<string, string> = {};
    items.forEach((i) => (map[i.id] = i.name));
    return map;
  }, [items]);

  const usedSet = useMemo(() => new Set(usedConversionIds), [usedConversionIds]);

  const columns: DataColumn<DBUOMConversion>[] = useMemo(
    () => [
      {
        key: "purchased_item_id",
        header: "Hàng hoá",
        sortValue: (conv) => itemMap[conv.purchased_item_id] || conv.purchased_item_id,
        render: (conv) => {
          const itemName = itemMap[conv.purchased_item_id] || conv.purchased_item_id;
          return (
            <div>
              <div className="font-bold text-text-primary">{itemName}</div>
              {conv.status === "INACTIVE" && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-secondary mt-1 border border-border">
                  Ngừng dùng
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "purchased_unit",
        header: "Đơn vị mua",
        sortValue: (conv) =>
          conv.purchased_unit
            ? unitMap[conv.purchased_unit] || conv.purchased_unit
            : conv.from_unit_id
            ? unitMap[conv.from_unit_id] || conv.from_unit_id
            : "",
        render: (conv) => {
          const pUnit = conv.purchased_unit
            ? unitMap[conv.purchased_unit] || conv.purchased_unit
            : !conv.purchased_unit && conv.from_unit_id
            ? unitMap[conv.from_unit_id] || conv.from_unit_id
            : "";
          return (
            <div className="flex items-center gap-2">
              <span className="text-text-primary font-medium">{pUnit}</span>
              {conv.purchase_only && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/20 text-warning-active border border-warning/30">
                  Chỉ cách mua
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "conversion_rate",
        header: "Tỷ lệ",
        sortValue: (conv) => Number(conv.conversion_rate) || 0,
        render: (conv) => (
          <span className="font-mono text-text-muted">x{conv.conversion_rate}</span>
        ),
      },
      {
        key: "base_unit",
        header: "Đơn vị gốc",
        sortValue: (conv) =>
          conv.base_unit
            ? unitMap[conv.base_unit] || conv.base_unit
            : conv.to_unit_id
            ? unitMap[conv.to_unit_id] || conv.to_unit_id
            : "",
        render: (conv) => {
          const bUnit = conv.base_unit
            ? unitMap[conv.base_unit] || conv.base_unit
            : !conv.base_unit && conv.to_unit_id
            ? unitMap[conv.to_unit_id] || conv.to_unit_id
            : "";
          return <span className="text-text-secondary font-medium">{bUnit}</span>;
        },
      },
    ],
    [itemMap, unitMap],
  );

  const validSortKeys = useMemo(
    () => ["id", ...columns.map((c) => c.key)],
    [columns],
  );
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredConversions = useMemo(() => {
    const q = search.toLowerCase();
    return conversions.filter((conv) => {
      const itemName = itemMap[conv.purchased_item_id] || "";
      return itemName.toLowerCase().includes(q);
    });
  }, [conversions, search, itemMap]);

  const sortedConversions = useMemo(() => {
    if (sortKey === "id") {
      return sortRows(filteredConversions, (c) => c.id, sortDir);
    }
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredConversions, col.sortValue, sortDir)
      : filteredConversions;
  }, [filteredConversions, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedConversions, page);
  }, [sortedConversions, page]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setSearch(next);
    setPage(1);
    router.replace(listUrl(next, 1, sortParam, dirParam), { scroll: false });
  };

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, 1, sortParam, dirParam), { scroll: false });
  };

  const handleClearFilter = () => {
    setSearch("");
    setPage(1);
    router.replace(listUrl("", 1, sortParam, dirParam), { scroll: false });
  };

  const currentListUrl = listUrl(search, slice.page, sortParam, dirParam);

  const renderCard = (conv: DBUOMConversion) => {
    const itemName = itemMap[conv.purchased_item_id] || conv.purchased_item_id;
    const pUnit = conv.purchased_unit
      ? unitMap[conv.purchased_unit] || conv.purchased_unit
      : !conv.purchased_unit && conv.from_unit_id
      ? unitMap[conv.from_unit_id] || conv.from_unit_id
      : "";
    const bUnit = conv.base_unit
      ? unitMap[conv.base_unit] || conv.base_unit
      : !conv.base_unit && conv.to_unit_id
      ? unitMap[conv.to_unit_id] || conv.to_unit_id
      : "";

    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="font-bold text-text-primary text-base leading-tight">
              {itemName}
            </div>
            <div className="font-mono text-[11px] text-text-muted mt-0.5 font-bold">
              {conv.id}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {conv.status === "INACTIVE" && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-secondary border border-border">
                Ngừng dùng
              </span>
            )}
            {conv.purchase_only && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-warning/20 text-warning-active border border-warning/30">
                Chỉ cách mua
              </span>
            )}
          </div>
        </div>
        <div className="text-sm text-text-secondary">
          1 {pUnit} = {conv.conversion_rate} {bUnit}
        </div>
      </div>
    );
  };

  const removal = canDelete
    ? {
        verb: "Xoá hoặc ngừng dùng",
        rowVerb: (conv: DBUOMConversion) =>
          usedSet.has(conv.id) ? "Ngừng dùng" : "Xoá",
        confirmMessage: (count: number) =>
          `Xoá hoặc ngừng dùng ${count} quy đổi đã chọn? Quy đổi đã dùng trong phiếu nhập sẽ chuyển sang ngừng dùng.`,
        remove: async (id: string) => {
          const fd = new FormData();
          fd.append("id", id);
          const res = await deleteConversionAction(fd);
          if (res?.error) {
            return { error: res.error };
          }
          if (res?.deactivated) {
            return { deactivated: true };
          }
          return {};
        },
      }
    : undefined;

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Kho"
        title="Bảng quy đổi"
        action={
          <Link
            href={`/admin/inventory/conversions/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            Tạo
          </Link>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search)}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-64">
          <label
            htmlFor="conversions-search"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Tìm hàng hóa
          </label>
          <input
            id="conversions-search"
            type="text"
            placeholder="Tên hàng hóa..."
            value={search}
            onChange={handleSearchChange}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          />
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(conv) => conv.id}
        getName={(conv) => itemMap[conv.purchased_item_id] || conv.purchased_item_id}
        getHref={(conv) =>
          `/admin/inventory/conversions/${encodeURIComponent(conv.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
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
            icon="🔄"
            title="Chưa có quy đổi"
            description="Thêm quy đổi đơn vị để quản lý nguyên liệu dễ dàng hơn."
          />
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="quy đổi"
            pageHref={(p) => listUrl(search, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
