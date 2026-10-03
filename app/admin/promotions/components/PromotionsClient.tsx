"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/shared/datetime";
import { formatNumber } from "@/lib/shared/format";
import { deletePromotionAction } from "@/app/admin/promotions/actions";
import type {
  DBPromotion,
  DBBrand,
  DBProduct,
  DBProductVariant,
  DBProductCategory,
} from "@/types/db";

interface PromotionsClientProps {
  promotions: DBPromotion[];
  brands: DBBrand[];
  products: DBProduct[];
  variants: DBProductVariant[];
  categories: DBProductCategory[];
  // ADMIN only (BR-ACCESS-003) -- everyone else may add and edit.
  canDelete: boolean;
  initialSearch?: string;
  initialStatus?: string;
  initialType?: string;
  initialPage?: string;
}

const VALID_STATUSES = ["ALL", "ACTIVE", "INACTIVE", "EXPIRED"] as const;
type PromotionStatusFilter = (typeof VALID_STATUSES)[number];

const VALID_TYPES = ["ALL", "ORDER_DISCOUNT", "PRODUCT_DISCOUNT"] as const;
type PromotionTypeFilter = (typeof VALID_TYPES)[number];

function parseStatus(raw: string | null | undefined): PromotionStatusFilter {
  if (raw && (VALID_STATUSES as readonly string[]).includes(raw)) {
    return raw as PromotionStatusFilter;
  }
  return "ALL";
}

function parseType(raw: string | null | undefined): PromotionTypeFilter {
  if (raw && (VALID_TYPES as readonly string[]).includes(raw)) {
    return raw as PromotionTypeFilter;
  }
  return "ALL";
}

function isExpired(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  const t = new Date(endDate).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

function formatDiscountText(promo: DBPromotion): string {
  if (promo.discount_type === "PERCENT") {
    return `Giảm ${promo.discount_value}%`;
  }
  if (promo.discount_type === "FLAT_PRICE") {
    return `Đồng giá ${formatNumber(promo.discount_value)}đ`;
  }
  return `Giảm ${formatNumber(promo.discount_value)}đ`;
}

function getScopeText(
  promo: DBPromotion,
  variantMap: Map<string, DBProductVariant>,
): string {
  if (promo.type === "ORDER_DISCOUNT") {
    return "Toàn đơn";
  }
  let keys: string[] = [];
  if (promo.applicable_products_json) {
    try {
      const parsed = JSON.parse(promo.applicable_products_json);
      if (parsed && typeof parsed === "object") {
        keys = Array.isArray(parsed) ? parsed : Object.keys(parsed);
      }
    } catch {}
  }
  const M = keys.length;
  const distinctProductIds = new Set<string>();
  for (const vid of keys) {
    const v = variantMap.get(vid);
    if (v?.product_id) {
      distinctProductIds.add(v.product_id);
    }
  }
  const N = distinctProductIds.size;
  return `${N} món, ${M} size`;
}

function listUrl(
  search: string,
  status: string,
  type: string,
  page: number = 1,
  sort?: string,
  dir?: string,
): string {
  const p = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed) p.set("q", trimmed);
  if (status && status !== "ALL") p.set("status", status);
  if (type && type !== "ALL") p.set("type", type);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/promotions?${qs}` : "/admin/promotions";
}

export default function PromotionsClient({
  promotions,
  brands,
  products: _products,
  variants,
  categories: _categories,
  canDelete,
  initialSearch,
  initialStatus,
  initialType,
  initialPage,
}: PromotionsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [search, setSearch] = useState(
    () => initialSearch ?? searchParams?.get("q") ?? "",
  );
  const [status, setStatus] = useState<PromotionStatusFilter>(() =>
    parseStatus(initialStatus ?? searchParams?.get("status")),
  );
  const [type, setType] = useState<PromotionTypeFilter>(() =>
    parseType(initialType ?? searchParams?.get("type")),
  );
  const [page, setPage] = useState<string | number | undefined>(
    () => initialPage ?? searchParams?.get("page") ?? undefined,
  );

  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
    else if (searchParams?.get("q") !== null) setSearch(searchParams?.get("q") || "");
  }, [initialSearch, searchParams]);

  useEffect(() => {
    if (initialStatus !== undefined) setStatus(parseStatus(initialStatus));
    else if (searchParams?.get("status") !== null)
      setStatus(parseStatus(searchParams?.get("status")));
  }, [initialStatus, searchParams]);

  useEffect(() => {
    if (initialType !== undefined) setType(parseType(initialType));
    else if (searchParams?.get("type") !== null)
      setType(parseType(searchParams?.get("type")));
  }, [initialType, searchParams]);

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage);
    else if (searchParams?.get("page") !== null)
      setPage(searchParams?.get("page") || undefined);
  }, [initialPage, searchParams]);

  const brandMap = useMemo(() => {
    const map: Record<string, string> = {};
    brands.forEach((b) => (map[b.id] = b.name));
    return map;
  }, [brands]);

  const variantMap = useMemo(() => {
    const map = new Map<string, DBProductVariant>();
    variants.forEach((v) => map.set(v.id, v));
    return map;
  }, [variants]);

  const columns: DataColumn<DBPromotion>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (p) => p.id,
        render: (p) => (
          <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
            {p.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên",
        sortValue: (p) => p.name,
        render: (p) => (
          <div className="font-bold text-text-primary">{p.name}</div>
        ),
      },
      {
        key: "brand",
        header: "Thương hiệu",
        sortValue: (p) => (p.brand_id ? brandMap[p.brand_id] || "Toàn hệ thống" : "Toàn hệ thống"),
        render: (p) => (
          <span className="text-text-secondary font-medium">
            {p.brand_id ? brandMap[p.brand_id] || "Toàn hệ thống" : "Toàn hệ thống"}
          </span>
        ),
      },
      {
        key: "discount",
        header: "Mức giảm",
        sortValue: (p) => Number(p.discount_value) || 0,
        render: (p) => (
          <span className="text-text-primary font-medium">
            {formatDiscountText(p)}
          </span>
        ),
      },
      {
        key: "scope",
        header: "Áp dụng",
        sortValue: (p) => getScopeText(p, variantMap),
        render: (p) => (
          <span className="text-text-secondary font-medium">
            {getScopeText(p, variantMap)}
          </span>
        ),
      },
      {
        key: "start",
        header: "Bắt đầu",
        sortValue: (p) => p.start_date || "",
        render: (p) => (
          <span className="text-text-secondary text-sm">
            {p.start_date ? formatDateTime(p.start_date) : "—"}
          </span>
        ),
      },
      {
        key: "end",
        header: "Kết thúc",
        sortValue: (p) => p.end_date || "",
        render: (p) => (
          <span className="text-text-secondary text-sm">
            {p.end_date ? formatDateTime(p.end_date) : "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        sortValue: (p) =>
          isExpired(p.end_date)
            ? "Đã hết hạn"
            : p.status === "INACTIVE"
            ? "Tạm ngưng"
            : "Đang chạy",
        render: (p) => {
          if (isExpired(p.end_date)) {
            return <Badge variant="danger">Đã hết hạn</Badge>;
          }
          if (p.status === "INACTIVE") {
            return <Badge variant="warning">Tạm ngưng</Badge>;
          }
          return <Badge variant="success">Đang chạy</Badge>;
        },
      },
    ],
    [brandMap, variantMap],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredPromotions = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return promotions.filter((promo) => {
      const expired = isExpired(promo.end_date);
      const matchesStatus =
        status === "ALL" ||
        (status === "ACTIVE" && promo.status === "ACTIVE" && !expired) ||
        (status === "INACTIVE" && (promo.status === "INACTIVE" || expired)) ||
        (status === "EXPIRED" && expired);

      if (!matchesStatus) return false;

      const matchesType = type === "ALL" || promo.type === type;
      if (!matchesType) return false;

      if (q) {
        const matchName = (promo.name || "").toLocaleLowerCase("vi").includes(q);
        const matchCode = (promo.code || "").toLocaleLowerCase("vi").includes(q);
        const matchId = (promo.id || "").toLocaleLowerCase("vi").includes(q);
        return matchName || matchCode || matchId;
      }

      return true;
    });
  }, [promotions, search, status, type]);

  const sortedPromotions = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredPromotions, col.sortValue, sortDir)
      : filteredPromotions;
  }, [filteredPromotions, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedPromotions, page);
  }, [sortedPromotions, page]);

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, status, type, 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const handleClearFilter = () => {
    setSearch("");
    setStatus("ALL");
    setType("ALL");
    setPage(1);
    router.replace(listUrl("", "ALL", "ALL", 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const currentListUrl = listUrl(search, status, type, slice.page, sortParam, dirParam);

  const renderCard = (promo: DBPromotion) => {
    const brandName = promo.brand_id ? brandMap[promo.brand_id] || "Toàn hệ thống" : "Toàn hệ thống";
    const discountText = formatDiscountText(promo);
    const scopeText = getScopeText(promo, variantMap);
    const expired = isExpired(promo.end_date);

    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <div>
            <div className="font-bold text-text-primary text-base leading-tight">
              {promo.name}
            </div>
            <div className="font-mono text-[11px] text-text-muted mt-0.5 font-bold">
              {promo.id}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-surface-secondary text-text-secondary border border-border">
              {brandName}
            </span>
            {expired ? (
              <Badge variant="danger">Đã hết hạn</Badge>
            ) : promo.status === "INACTIVE" ? (
              <Badge variant="warning">Tạm ngưng</Badge>
            ) : (
              <Badge variant="success">Đang chạy</Badge>
            )}
          </div>
        </div>
        <div className="text-xs text-text-secondary pt-1 border-t border-border/50 flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-text-primary">{discountText}</span>
            <span>{scopeText}</span>
          </div>
          {(promo.start_date || promo.end_date) && (
            <div className="text-[11px] text-text-muted">
              {promo.start_date ? formatDateTime(promo.start_date) : "—"} &rarr;{" "}
              {promo.end_date ? formatDateTime(promo.end_date) : "—"}
            </div>
          )}
        </div>
      </div>
    );
  };

  const removal = canDelete
    ? {
        verb: "Xoá",
        confirmMessage: (count: number) =>
          `Xoá ${count} khuyến mãi? Việc này không thể hoàn tác.`,
        remove: async (id: string) => {
          const res = await deletePromotionAction(id);
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
        group="Bán hàng"
        title="Khuyến mãi"
        action={
          <Link
            href={`/admin/promotions/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            + Thêm khuyến mãi
          </Link>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search || status !== "ALL" || type !== "ALL")}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-64">
          <label
            htmlFor="promotions-search"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Tìm khuyến mãi
          </label>
          <input
            id="promotions-search"
            type="text"
            placeholder="Tên, mã giảm giá hoặc mã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-48">
          <label
            htmlFor="promotions-status"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Trạng thái
          </label>
          <select
            id="promotions-status"
            value={status}
            onChange={(e) => setStatus(parseStatus(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ALL">Tất cả</option>
            <option value="ACTIVE">Đang chạy</option>
            <option value="INACTIVE">Tạm ngưng hoặc hết hạn</option>
            <option value="EXPIRED">Chỉ đã hết hạn</option>
          </select>
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-48">
          <label
            htmlFor="promotions-type"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Loại
          </label>
          <select
            id="promotions-type"
            value={type}
            onChange={(e) => setType(parseType(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ALL">Tất cả</option>
            <option value="ORDER_DISCOUNT">Giảm đơn hàng</option>
            <option value="PRODUCT_DISCOUNT">Giảm theo món</option>
          </select>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(p) => p.id}
        getName={(p) => p.name}
        getHref={(p) =>
          `/admin/promotions/${encodeURIComponent(p.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={renderCard}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, status, type, 1, k, d),
        }}
        removal={removal}
        empty={
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
            <div className="text-text-secondary text-sm">
              Không có khuyến mãi nào khớp bộ lọc
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
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="khuyến mãi"
            pageHref={(p) => listUrl(search, status, type, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
