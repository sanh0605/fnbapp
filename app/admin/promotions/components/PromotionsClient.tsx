"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { Badge } from "@/components/ui/Badge";
import { formatDate, formatDateTimeFull } from "@/lib/shared/datetime";
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

function formatPromotionDate(val: string | null | undefined): string {
  if (!val) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return formatDate(val);
  return formatDateTimeFull(val);
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
          <span className="font-mono text-xs text-primary">
            {p.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên",
        sortValue: (p) => p.name,
        render: (p) => (
          <div className="text-text-primary">{p.name}</div>
        ),
      },
      {
        key: "brand",
        header: "Thương hiệu",
        sortValue: (p) => (p.brand_id ? brandMap[p.brand_id] || "Toàn hệ thống" : "Toàn hệ thống"),
        render: (p) => (
          <span className="text-text-secondary">
            {p.brand_id ? brandMap[p.brand_id] || "Toàn hệ thống" : "Toàn hệ thống"}
          </span>
        ),
      },
      {
        key: "discount",
        header: "Mức giảm",
        sortValue: (p) => Number(p.discount_value) || 0,
        render: (p) => (
          <span className="text-text-primary">
            {formatDiscountText(p)}
          </span>
        ),
      },
      {
        key: "scope",
        header: "Áp dụng",
        sortValue: (p) => getScopeText(p, variantMap),
        render: (p) => (
          <span className="text-text-secondary">
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
            {formatPromotionDate(p.start_date)}
          </span>
        ),
      },
      {
        key: "end",
        header: "Kết thúc",
        sortValue: (p) => p.end_date || "",
        render: (p) => (
          <span className="text-text-secondary text-sm">
            {formatPromotionDate(p.end_date)}
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

  const appliedSearch = searchParams?.get("q") ?? initialSearch ?? "";
  const appliedStatus = parseStatus(searchParams?.get("status") ?? initialStatus);
  const appliedType = parseType(searchParams?.get("type") ?? initialType);

  const activeCount =
    (appliedSearch.trim() ? 1 : 0) +
    (appliedStatus !== "ALL" ? 1 : 0) +
    (appliedType !== "ALL" ? 1 : 0);

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
          <Button
            href={`/admin/promotions/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            variant="primary"
          >
            Tạo
          </Button>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search || status !== "ALL" || type !== "ALL")}
        activeCount={activeCount}
        search={
          <div className="shrink-0 w-full md:w-64">
            <Field label="Tìm khuyến mãi" htmlFor="promotions-search">
              <TextInput
                id="promotions-search"
                placeholder="Ví dụ: Giảm 10%"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
        }
      >
        <div className="shrink-0 w-full md:w-48">
          <Field label="Trạng thái" htmlFor="promotions-status">
            <Select
              id="promotions-status"
              value={status}
              onChange={(e) => setStatus(parseStatus(e.target.value))}
            >
              <option value="ALL">Tất cả</option>
              <option value="ACTIVE">Đang chạy</option>
              <option value="INACTIVE">Tạm ngưng hoặc hết hạn</option>
              <option value="EXPIRED">Chỉ đã hết hạn</option>
            </Select>
          </Field>
        </div>
        <div className="shrink-0 w-full md:w-48">
          <Field label="Loại" htmlFor="promotions-type">
            <Select
              id="promotions-type"
              value={type}
              onChange={(e) => setType(parseType(e.target.value))}
            >
              <option value="ALL">Tất cả</option>
              <option value="ORDER_DISCOUNT">Giảm đơn hàng</option>
              <option value="PRODUCT_DISCOUNT">Giảm theo món</option>
            </Select>
          </Field>
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
        phoneRow={(promo) => {
          const brandName = promo.brand_id ? brandMap[promo.brand_id] || "Toàn hệ thống" : "Toàn hệ thống";
          const discountText = formatDiscountText(promo);
          const scopeText = getScopeText(promo, variantMap);
          const expired = isExpired(promo.end_date);

          const datesText =
            !promo.start_date && !promo.end_date
              ? null
              : `${formatPromotionDate(promo.start_date)} → ${formatPromotionDate(promo.end_date)}`;

          const meta = [datesText, brandName, scopeText].filter(Boolean).join(" · ");

          return {
            title: promo.name,
            value: discountText,
            meta,
            badge: expired ? (
              <Badge variant="danger">Đã hết hạn</Badge>
            ) : promo.status === "INACTIVE" ? (
              <Badge variant="warning">Tạm ngưng</Badge>
            ) : (
              <Badge variant="success">Đang chạy</Badge>
            ),
          };
        }}
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
                className="text-danger hover:underline font-medium text-sm min-h-[48px] md:min-h-[40px] inline-flex items-center"
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
