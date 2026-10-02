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
import { deletePurchasedItemAction } from "../actions";
import type { DBPurchasedItem, DBItemCategory, DBUOMConversion, DBUnit } from "@/types/db";

interface ItemsClientProps {
  categories: DBItemCategory[];
  items: DBPurchasedItem[];
  conversions: DBUOMConversion[];
  units: DBUnit[];
  unitLockedItemIds: string[];
  canDelete: boolean;
  initialSearch?: string;
  initialCategory?: string;
  initialPage?: string;
}

function getUnitName(unitIdOrName: string | undefined, units: DBUnit[]): string {
  if (!unitIdOrName) return "";
  const found = units.find((u) => u.id === unitIdOrName || u.name === unitIdOrName);
  return found?.name || unitIdOrName;
}

function listUrl(search: string, category: string, page: number = 1): string {
  const p = new URLSearchParams();
  if (search) p.set("q", search);
  if (category && category !== "ALL") p.set("category", category);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/admin/inventory/items?${qs}` : "/admin/inventory/items";
}

export default function ItemsClient({
  categories,
  items,
  conversions,
  units,
  canDelete,
  initialSearch,
  initialCategory,
  initialPage,
}: ItemsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => initialSearch ?? searchParams?.get("q") ?? "");
  const [category, setCategory] = useState(
    () => initialCategory ?? searchParams?.get("category") ?? "ALL",
  );
  const [page, setPage] = useState<string | number | undefined>(
    () => initialPage ?? searchParams?.get("page") ?? undefined,
  );

  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
    else if (searchParams?.get("q") !== null) setSearch(searchParams?.get("q") || "");
  }, [initialSearch, searchParams]);

  useEffect(() => {
    if (initialCategory !== undefined) setCategory(initialCategory);
    else if (searchParams?.get("category") !== null)
      setCategory(searchParams?.get("category") || "ALL");
  }, [initialCategory, searchParams]);

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage);
    else if (searchParams?.get("page") !== null)
      setPage(searchParams?.get("page") || undefined);
  }, [initialPage, searchParams]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [categories]);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);
      const matchCategory =
        category === "ALL" || !category || item.item_category_id === category;
      return matchSearch && matchCategory;
    });
  }, [items, search, category]);

  const slice = useMemo(() => {
    return paginate(filteredItems, page);
  }, [filteredItems, page]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setSearch(next);
    setPage(1);
    router.replace(listUrl(next, category, 1), { scroll: false });
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCat = e.target.value;
    setCategory(nextCat);
    setPage(1);
    router.replace(listUrl(search, nextCat, 1), { scroll: false });
  };

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, category, 1), { scroll: false });
  };

  const handleClearFilter = () => {
    setSearch("");
    setCategory("ALL");
    setPage(1);
    router.replace(listUrl("", "ALL", 1), { scroll: false });
  };

  const currentListUrl = listUrl(search, category, slice.page);

  const columns: DataColumn<DBPurchasedItem>[] = [
    {
      key: "id",
      header: "Mã",
      render: (item) => (
        <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
          {item.id}
        </span>
      ),
    },
    {
      key: "name",
      header: "Tên",
      render: (item) => (
        <div>
          <div className="font-bold text-text-primary">{item.name}</div>
          {item.status === "INACTIVE" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-secondary mt-1 border border-border">
              Ngừng dùng
            </span>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Phân loại",
      render: (item) => (
        <span className="text-text-secondary font-medium">
          {categoryMap[item.item_category_id] || "—"}
        </span>
      ),
    },
    {
      key: "conversions",
      header: "Quy đổi",
      secondary: true,
      render: (item) => {
        const itemConversions = conversions.filter((c) => c.purchased_item_id === item.id);
        if (itemConversions.length === 0) return <span className="text-text-muted">—</span>;
        return (
          <div className="flex flex-col gap-0.5 text-xs text-text-secondary">
            {itemConversions.map((conv) => (
              <div key={conv.id}>
                1 {getUnitName(conv.purchased_unit, units)} = {conv.conversion_rate}{" "}
                {getUnitName(conv.base_unit, units)}
              </div>
            ))}
          </div>
        );
      },
    },
  ];

  const renderCard = (item: DBPurchasedItem) => {
    const itemConversions = conversions.filter((c) => c.purchased_item_id === item.id);
    const catName = categoryMap[item.item_category_id] || "—";
    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="font-bold text-text-primary text-base leading-tight">
              {item.name}
            </div>
            <div className="font-mono text-[11px] text-text-muted mt-0.5 font-bold">
              {item.id}
            </div>
          </div>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-secondary text-text-secondary border border-border shrink-0">
            {catName}
          </span>
        </div>
        {itemConversions.length > 0 && (
          <div className="text-xs text-text-secondary pt-1 border-t border-border/50">
            {itemConversions.map((conv) => (
              <div key={conv.id}>
                1 {getUnitName(conv.purchased_unit, units)} = {conv.conversion_rate}{" "}
                {getUnitName(conv.base_unit, units)}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const removal = canDelete
    ? {
        verb: "Xoá",
        confirmMessage: (count: number) => `Xoá ${count} hàng hoá đã chọn?`,
        remove: async (id: string) => {
          const fd = new FormData();
          fd.append("id", id);
          const res = await deletePurchasedItemAction(fd);
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
        title="Hàng hoá"
        action={
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Link
              href="/admin/inventory/conversions"
              className="border border-border bg-surface-card text-text-primary flex items-center justify-center font-bold text-sm transition-colors hover:bg-page rounded-lg h-11 px-4 min-h-[44px]"
            >
              Bảng quy đổi
            </Link>
            <Link
              href={`/admin/inventory/items/new?returnTo=${encodeURIComponent(currentListUrl)}`}
              className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
            >
              + Thêm Hàng Mua Vào
            </Link>
          </div>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search || (category && category !== "ALL"))}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-64">
          <label
            htmlFor="items-search"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Tìm kiếm
          </label>
          <input
            id="items-search"
            type="text"
            placeholder="Tên hàng hóa..."
            value={search}
            onChange={handleSearchChange}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-48">
          <label
            htmlFor="items-category"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Phân loại
          </label>
          <select
            id="items-category"
            value={category}
            onChange={handleCategoryChange}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ALL">Tất cả</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(item) => item.id}
        getName={(item) => item.name}
        getHref={(item) =>
          `/admin/inventory/items/${encodeURIComponent(item.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={renderCard}
        removal={removal}
        empty={
          <EmptyState
            icon="📦"
            title="Chưa có hàng hóa"
            description="Thêm hàng hóa để quản lý tồn kho."
          />
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="hàng hoá"
            pageHref={(p) => listUrl(search, category, p)}
          />
        </div>
      )}
    </div>
  );
}
