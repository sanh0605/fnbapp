"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Image as ImageIcon } from "lucide-react";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/shared/format";
import { pauseProduct } from "./actions";

interface ProductVariant {
  id?: string;
  size_name: string;
  price: number | string;
  status: string;
}

interface Product {
  id: string;
  name: string;
  category_id: string;
  status: string;
  image_url?: string;
  variants: ProductVariant[];
  priceHistory: any[];
  neverSold: boolean;
  hasNoSellableVariant: boolean;
  isLinkedTopping?: boolean;
  [key: string]: any;
}

interface Category {
  id: string;
  name: string;
}

interface ProductsClientProps {
  enhancedProducts: Product[];
  activeCategories: Category[];
  initialSearch?: string;
  initialCategory?: string;
  initialStatus?: string;
  initialPage?: string;
  canDelete?: boolean;
}

const VALID_STATUSES = ["ACTIVE", "INACTIVE", "DELETED"] as const;
type ProductStatus = typeof VALID_STATUSES[number];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Đang bán",
  INACTIVE: "Ngừng bán",
  DELETED: "Đã xóa",
};

function parseStatus(raw: string | null | undefined): ProductStatus {
  if (raw && (VALID_STATUSES as readonly string[]).includes(raw)) {
    return raw as ProductStatus;
  }
  return "ACTIVE";
}

function listUrl(
  search: string,
  category: string,
  status: string,
  page: number = 1,
  sort?: string,
  dir?: string,
): string {
  const p = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed) p.set("q", trimmed);
  if (category && category !== "ALL") p.set("category", category);
  if (status && status !== "ACTIVE") p.set("status", status);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/products?${qs}` : "/admin/products";
}

export default function ProductsClient({
  enhancedProducts,
  activeCategories,
  initialSearch,
  initialCategory,
  initialStatus,
  initialPage,
}: ProductsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [search, setSearch] = useState(
    () => initialSearch ?? searchParams?.get("q") ?? "",
  );
  const [category, setCategory] = useState(
    () => initialCategory || searchParams?.get("category") || "ALL",
  );
  const [status, setStatus] = useState<ProductStatus>(
    () => parseStatus(initialStatus ?? searchParams?.get("status")),
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
    if (initialStatus !== undefined) setStatus(parseStatus(initialStatus));
    else if (searchParams?.get("status") !== null)
      setStatus(parseStatus(searchParams?.get("status")));
  }, [initialStatus, searchParams]);

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage);
    else if (searchParams?.get("page") !== null)
      setPage(searchParams?.get("page") || undefined);
  }, [initialPage, searchParams]);

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeCategories.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [activeCategories]);

  const columns: DataColumn<Product>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (product) => product.id,
        render: (product) => (
          <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
            {product.id}
          </span>
        ),
      },
      {
        key: "image",
        header: "Ảnh",
        secondary: true,
        render: (product) => (
          <div className="w-10 h-10 rounded-lg bg-page border border-border flex items-center justify-center overflow-hidden shrink-0">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <ImageIcon className="w-5 h-5 text-text-muted" />
            )}
          </div>
        ),
      },
      {
        key: "name",
        header: "Tên",
        sortValue: (product) => product.name,
        render: (product) => (
          <div className="font-bold text-text-primary">{product.name}</div>
        ),
      },
      {
        key: "category",
        header: "Nhóm",
        sortValue: (product) => categoryMap[product.category_id] || "Chưa phân loại",
        render: (product) => (
          <span className="text-text-secondary font-medium">
            {categoryMap[product.category_id] || "Chưa phân loại"}
          </span>
        ),
      },
      {
        key: "sizes",
        header: "Size & giá",
        sortValue: (product) => {
          if (!product.variants || product.variants.length === 0) return null;
          const prices = product.variants
            .map((v) => Number(v.price))
            .filter((p) => Number.isFinite(p));
          if (prices.length === 0) return null;
          return Math.min(...prices);
        },
        render: (product) => {
          const sizeTexts = (product.variants || []).map(
            (v) => `${v.size_name} ${formatNumber(v.price)}`,
          );
          const text = sizeTexts.join(" · ");
          return (
            <div className="flex flex-col gap-1 items-start">
              {text ? (
                <span className="text-text-primary text-xs font-medium">{text}</span>
              ) : (
                <span className="text-text-muted text-xs">—</span>
              )}
              {product.hasNoSellableVariant && (
                <Badge variant="danger">Không có size nào đang bán</Badge>
              )}
            </div>
          );
        },
      },
      {
        key: "status",
        header: "Trạng thái",
        sortValue: (product) => STATUS_LABELS[product.status] || product.status,
        render: (product) => {
          if (product.status === "ACTIVE") {
            return <Badge variant="success">Đang bán</Badge>;
          }
          if (product.status === "INACTIVE") {
            return <Badge variant="warning">Ngừng bán</Badge>;
          }
          return <Badge variant="neutral">Đã xóa</Badge>;
        },
      },
    ],
    [categoryMap],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return enhancedProducts.filter((product) => {
      const matchCategory =
        category === "ALL" || !category || product.category_id === category;
      const matchStatus = status ? product.status === status : product.status === "ACTIVE";
      if (!matchCategory || !matchStatus) return false;

      if (q) {
        const matchName = (product.name || "").toLocaleLowerCase("vi").includes(q);
        const matchId = (product.id || "").toLocaleLowerCase("vi").includes(q);
        return matchName || matchId;
      }
      return true;
    });
  }, [enhancedProducts, category, status, search]);

  const matchingOtherStatus = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    if (!q || filteredProducts.length > 0) return null;
    const match = enhancedProducts.find((product) => {
      const matchCategory =
        category === "ALL" || !category || product.category_id === category;
      if (!matchCategory) return false;
      if (product.status === status) return false;

      const matchName = (product.name || "").toLocaleLowerCase("vi").includes(q);
      const matchId = (product.id || "").toLocaleLowerCase("vi").includes(q);
      return matchName || matchId;
    });
    return match ? (match.status as ProductStatus) : null;
  }, [enhancedProducts, category, status, search, filteredProducts.length]);

  const sortedProducts = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredProducts, col.sortValue, sortDir)
      : filteredProducts;
  }, [filteredProducts, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedProducts, page);
  }, [sortedProducts, page]);

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, category, status, 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const handleClearFilter = () => {
    setSearch("");
    setCategory("ALL");
    setStatus("ACTIVE");
    setPage(1);
    router.replace(listUrl("", "ALL", "ACTIVE", 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const currentListUrl = listUrl(search, category, status, slice.page, sortParam, dirParam);

  const renderCard = (product: Product) => {
    const catName = categoryMap[product.category_id] || "Chưa phân loại";
    const sizeTexts = (product.variants || []).map(
      (v) => `${v.size_name} ${formatNumber(v.price)}`,
    );
    const sizesSummary = sizeTexts.join(" · ");

    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="font-bold text-text-primary text-base leading-tight">
              {product.name}
            </div>
            <div className="font-mono text-[11px] text-text-muted mt-0.5 font-bold">
              {product.id}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-secondary text-text-secondary border border-border">
              {catName}
            </span>
            {product.status === "ACTIVE" ? (
              <Badge variant="success">Đang bán</Badge>
            ) : product.status === "INACTIVE" ? (
              <Badge variant="warning">Ngừng bán</Badge>
            ) : (
              <Badge variant="neutral">Đã xóa</Badge>
            )}
          </div>
        </div>
        <div className="text-xs text-text-secondary pt-1 border-t border-border/50 flex flex-col gap-1">
          {sizesSummary && <div>{sizesSummary}</div>}
          {product.hasNoSellableVariant && (
            <div>
              <Badge variant="danger">Không có size nào đang bán</Badge>
            </div>
          )}
        </div>
      </div>
    );
  };

  const removal =
    status === "ACTIVE"
      ? {
          verb: "Ngừng bán",
          confirmMessage: (count: number) =>
            `Ngừng bán ${count} món? Món sẽ ẩn khỏi máy bán hàng.`,
          remove: async (id: string) => {
            const fd = new FormData();
            fd.append("id", id);
            const res = await pauseProduct(fd);
            if (res?.error) {
              return { error: res.error };
            }
            return { deactivated: true };
          },
        }
      : undefined;

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Món"
        title="Món"
        action={
          <Link
            href={`/admin/products/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            + Thêm món
          </Link>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search || (category && category !== "ALL") || status !== "ACTIVE")}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-64">
          <label
            htmlFor="products-search"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Tìm món
          </label>
          <input
            id="products-search"
            type="text"
            placeholder="Tên hoặc mã món..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-48">
          <label
            htmlFor="products-category"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Nhóm món
          </label>
          <select
            id="products-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ALL">Tất cả nhóm</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-48">
          <label
            htmlFor="products-status"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Trạng thái
          </label>
          <select
            id="products-status"
            value={status}
            onChange={(e) => setStatus(parseStatus(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ACTIVE">Đang bán</option>
            <option value="INACTIVE">Ngừng bán</option>
            <option value="DELETED">Đã xóa</option>
          </select>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(product) => product.id}
        getName={(product) => product.name}
        getHref={(product) =>
          `/admin/products/${encodeURIComponent(product.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={renderCard}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, category, status, 1, k, d),
        }}
        removal={removal}
        empty={
          matchingOtherStatus ? (
            <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
              <div className="text-text-primary font-medium">
                Có món khớp nhưng đang ở trạng thái &ldquo;
                {STATUS_LABELS[matchingOtherStatus] || matchingOtherStatus}&rdquo;.
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setStatus(matchingOtherStatus);
                    setPage(1);
                    router.replace(
                      listUrl(search, category, matchingOtherStatus, 1, sortParam, dirParam),
                      { scroll: false },
                    );
                  }}
                  className="text-primary hover:text-primary-hover font-medium underline text-sm min-h-[44px] inline-flex items-center"
                >
                  Xem &ldquo;{STATUS_LABELS[matchingOtherStatus] || matchingOtherStatus}&rdquo;
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
              <div className="text-text-secondary text-sm">
                Không có dòng nào khớp bộ lọc
              </div>
              <div>
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="text-danger hover:underline font-medium text-sm min-h-[44px] inline-flex items-center"
                >
                  Xoá lọc
                </button>
              </div>
            </div>
          )
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="món"
            pageHref={(p) => listUrl(search, category, status, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
