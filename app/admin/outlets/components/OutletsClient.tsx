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
import { formatDate } from "@/lib/shared/datetime";
import { retireOutlet } from "@/app/admin/outlets/actions";
import type { DBOutlet, DBBrand } from "@/types/db";

interface OutletsClientProps {
  outlets: DBOutlet[];
  brands: DBBrand[];
  initialSearch?: string;
  initialStatus?: string;
  initialPage?: string;
}

const VALID_STATUSES = ["ACTIVE", "INACTIVE", "ALL"] as const;
type OutletStatusFilter = (typeof VALID_STATUSES)[number];

function parseStatus(raw: string | null | undefined): OutletStatusFilter {
  if (raw === "INACTIVE" || raw === "ALL") return raw;
  return "ACTIVE";
}

function formatHours(openTime: string | null | undefined, closeTime: string | null | undefined): string {
  if (openTime && closeTime) {
    return `${openTime.slice(0, 5)} - ${closeTime.slice(0, 5)}`;
  }
  return "Chưa đặt";
}

function listUrl(
  search: string,
  status: string,
  page: number = 1,
  sort?: string,
  dir?: string,
): string {
  const p = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed) p.set("q", trimmed);
  if (status && status !== "ACTIVE") p.set("status", status);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/outlets?${qs}` : "/admin/outlets";
}

export default function OutletsClient({
  outlets,
  brands,
  initialSearch,
  initialStatus,
  initialPage,
}: OutletsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [search, setSearch] = useState(
    () => initialSearch ?? searchParams?.get("q") ?? "",
  );
  const [status, setStatus] = useState<OutletStatusFilter>(() =>
    parseStatus(initialStatus ?? searchParams?.get("status")),
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
    if (initialPage !== undefined) setPage(initialPage);
    else if (searchParams?.get("page") !== null)
      setPage(searchParams?.get("page") || undefined);
  }, [initialPage, searchParams]);

  const brandMap = useMemo(() => {
    const map: Record<string, string> = {};
    brands.forEach((b) => (map[b.id] = b.name));
    return map;
  }, [brands]);

  const columns: DataColumn<DBOutlet>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (o) => o.id,
        render: (o) => (
          <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
            {o.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên",
        sortValue: (o) => o.name,
        render: (o) => (
          <div className="font-bold text-text-primary">{o.name}</div>
        ),
      },
      {
        key: "brand",
        header: "Thương hiệu",
        sortValue: (o) => brandMap[o.brand_id] || o.brand_id,
        render: (o) => (
          <span className="text-text-secondary font-medium">
            {brandMap[o.brand_id] || o.brand_id}
          </span>
        ),
      },
      {
        key: "code",
        header: "Mã đơn",
        sortValue: (o) => o.code,
        render: (o) => (
          <span className="font-mono text-primary font-bold">
            {o.code}
          </span>
        ),
      },
      {
        key: "hours",
        header: "Giờ hoạt động",
        sortValue: (o) => formatHours(o.open_time, o.close_time),
        render: (o) => (
          <span className="text-text-secondary text-sm">
            {formatHours(o.open_time, o.close_time)}
          </span>
        ),
      },
      {
        key: "start_date",
        header: "Bắt đầu",
        sortValue: (o) => o.start_date || "",
        render: (o) => (
          <span className="text-text-secondary text-sm">
            {o.start_date ? formatDate(o.start_date) : "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        sortValue: (o) => (o.status === "ACTIVE" ? "Đang hoạt động" : "Ngừng hoạt động"),
        render: (o) =>
          o.status === "ACTIVE" ? (
            <Badge variant="success">Đang hoạt động</Badge>
          ) : (
            <Badge variant="warning">Ngừng hoạt động</Badge>
          ),
      },
    ],
    [brandMap],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredOutlets = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return outlets.filter((outlet) => {
      const matchStatus =
        status === "ALL" ||
        (status === "ACTIVE" ? outlet.status === "ACTIVE" : outlet.status !== "ACTIVE");
      if (!matchStatus) return false;

      if (q) {
        const matchName = (outlet.name || "").toLocaleLowerCase("vi").includes(q);
        const matchCode = (outlet.code || "").toLocaleLowerCase("vi").includes(q);
        const matchId = (outlet.id || "").toLocaleLowerCase("vi").includes(q);
        return matchName || matchCode || matchId;
      }
      return true;
    });
  }, [outlets, search, status]);

  const sortedOutlets = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredOutlets, col.sortValue, sortDir)
      : filteredOutlets;
  }, [filteredOutlets, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedOutlets, page);
  }, [sortedOutlets, page]);

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, status, 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const handleClearFilter = () => {
    setSearch("");
    setStatus("ACTIVE");
    setPage(1);
    router.replace(listUrl("", "ACTIVE", 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const currentListUrl = listUrl(search, status, slice.page, sortParam, dirParam);

  const renderCard = (outlet: DBOutlet) => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-bold text-text-primary text-base leading-tight">
            {outlet.name}
          </div>
          <div className="text-[11px] text-text-muted mt-0.5">
            {brandMap[outlet.brand_id] || outlet.brand_id}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-primary-soft text-primary border border-primary/20 font-mono">
            {outlet.code}
          </span>
          {outlet.status === "ACTIVE" ? (
            <Badge variant="success">Đang hoạt động</Badge>
          ) : (
            <Badge variant="warning">Ngừng hoạt động</Badge>
          )}
        </div>
      </div>
      <div className="text-xs text-text-secondary pt-1 border-t border-border/50 flex flex-col gap-1">
        <div>
          <span className="text-text-muted">Giờ hoạt động: </span>
          <span>{formatHours(outlet.open_time, outlet.close_time)}</span>
        </div>
        {outlet.start_date && (
          <div>
            <span className="text-text-muted">Bắt đầu: </span>
            <span>{formatDate(outlet.start_date)}</span>
          </div>
        )}
      </div>
    </div>
  );

  const removal =
    status === "ACTIVE"
      ? {
          verb: "Ngừng hoạt động",
          confirmMessage: (count: number) =>
            `Ngừng hoạt động ${count} điểm bán? Điểm bán sẽ không còn dùng để mở máy bán hàng; dữ liệu và mã vẫn giữ nguyên.`,
          remove: async (id: string) => {
            const fd = new FormData();
            fd.append("id", id);
            const res = await retireOutlet(fd);
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
        group="Bán hàng"
        title="Điểm bán"
        action={
          <Link
            href={`/admin/outlets/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            + Thêm điểm bán
          </Link>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search || status !== "ACTIVE")}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-64">
          <label
            htmlFor="outlets-search"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Tìm điểm bán
          </label>
          <input
            id="outlets-search"
            type="text"
            placeholder="Tên, mã đơn hoặc mã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-48">
          <label
            htmlFor="outlets-status"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Trạng thái
          </label>
          <select
            id="outlets-status"
            value={status}
            onChange={(e) => setStatus(parseStatus(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Ngừng hoạt động</option>
            <option value="ALL">Tất cả</option>
          </select>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(o) => o.id}
        getName={(o) => o.name}
        getHref={(o) =>
          `/admin/outlets/${encodeURIComponent(o.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={renderCard}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, status, 1, k, d),
        }}
        removal={removal}
        empty={
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
            <div className="text-text-secondary text-sm">
              Không có điểm bán nào khớp bộ lọc
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
            unit="điểm bán"
            pageHref={(p) => listUrl(search, status, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
