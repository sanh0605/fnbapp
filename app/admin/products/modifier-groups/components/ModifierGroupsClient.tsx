"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { formatNumber } from "@/lib/shared/format";
import { Badge } from "@/components/ui/Badge";
import type { DBModifierGroup } from "@/types/db";

export interface ModifierGroupRow {
  group: DBModifierGroup;
  optionNames: string[];
  productCount: number;
}

export interface ModifierGroupsClientProps {
  rows: ModifierGroupRow[];
  initialSearch?: string;
  initialPage?: string;
}

function listUrl(
  search: string,
  page: number = 1,
  sort?: string,
  dir?: string,
): string {
  const p = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed) p.set("q", trimmed);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/products/modifier-groups?${qs}` : "/admin/products/modifier-groups";
}

export default function ModifierGroupsClient({
  rows,
  initialSearch = "",
  initialPage,
}: ModifierGroupsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [search, setSearch] = useState(
    () => initialSearch ?? searchParams?.get("q") ?? "",
  );
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

  const columns: DataColumn<ModifierGroupRow>[] = useMemo(
    () => [
      {
        key: "sort_order",
        header: "Thứ tự hiện",
        nowrap: true,
        sortValue: (r) => r.group.sort_order,
        render: (r) => (
          <span className="font-mono text-xs text-text-secondary whitespace-nowrap">
            {r.group.sort_order}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên nhóm",
        sortValue: (r) => r.group.name,
        render: (r) => (
          <div className="text-text-primary font-normal">{r.group.name}</div>
        ),
      },
      {
        key: "selection_mode",
        header: "Kiểu chọn",
        nowrap: true,
        sortValue: (r) => (r.group.selection_mode === "ONE" ? "Chọn một" : "Chọn nhiều"),
        render: (r) => (
          <span className="text-text-secondary font-normal">
            {r.group.selection_mode === "ONE" ? "Chọn một" : "Chọn nhiều"}
          </span>
        ),
      },
      {
        key: "max_total",
        header: "Tối đa",
        nowrap: true,
        secondary: true,
        sortValue: (r) => r.group.max_total ?? 0,
        render: (r) => (
          <span className="text-text-secondary font-normal">
            {r.group.selection_mode === "ONE"
              ? "—"
              : r.group.max_total
              ? `${r.group.max_total} phần`
              : "Không giới hạn"}
          </span>
        ),
      },
      {
        key: "allow_standalone",
        header: "Bán riêng",
        nowrap: true,
        sortValue: (r) => (r.group.allow_standalone ? "Có" : "Không"),
        render: (r) => (
          <span className="text-text-secondary font-normal whitespace-nowrap">
            {r.group.selection_mode === "ONE"
              ? "—"
              : r.group.allow_standalone
              ? "Có"
              : "Không"}
          </span>
        ),
      },
      {
        key: "optionNames",
        header: "Tuỳ chọn",
        sortValue: (r) => r.optionNames.join(", "),
        render: (r) => (
          <div className="text-text-secondary font-normal">
            {r.optionNames.length > 0
              ? r.optionNames.join(", ")
              : "Chưa có tuỳ chọn"}
          </div>
        ),
      },
      {
        key: "productCount",
        header: "Số món",
        align: "right",
        nowrap: true,
        sortValue: (r) => r.productCount,
        render: (r) => (
          <span className="text-text-secondary font-normal tabular-nums whitespace-nowrap">
            {formatNumber(r.productCount)} món
          </span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        nowrap: true,
        sortValue: (r) => (r.group.status === "ACTIVE" ? "Đang dùng" : "Ngừng dùng"),
        render: (r) => (
          <Badge variant={r.group.status === "ACTIVE" ? "success" : "neutral"}>
            {r.group.status === "ACTIVE" ? "Đang dùng" : "Ngừng dùng"}
          </Badge>
        ),
      },
    ],
    [],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: parsedDir } = parseSort(rawSort, rawDir, validSortKeys, "sort_order");
  const sortDir = rawDir ? parsedDir : (rawSort ? parsedDir : "asc");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return rows.filter((r) => {
      if (!q) return true;
      const matchName = (r.group.name || "").toLocaleLowerCase("vi").includes(q);
      const matchOptions = r.optionNames.some((n) =>
        n.toLocaleLowerCase("vi").includes(q),
      );
      return matchName || matchOptions;
    });
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    if (sortKey === "sort_order") {
      const modifier = sortDir === "desc" ? -1 : 1;
      return [...filteredRows].sort((a, b) => {
        const orderDiff = (a.group.sort_order - b.group.sort_order) * modifier;
        if (orderDiff !== 0) return orderDiff;
        return a.group.name.localeCompare(b.group.name, "vi") * modifier;
      });
    }
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredRows, col.sortValue, sortDir)
      : filteredRows;
  }, [filteredRows, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedRows, page);
  }, [sortedRows, page]);

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const handleClearFilter = () => {
    setSearch("");
    setPage(1);
    router.replace(listUrl("", 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const currentListUrl = listUrl(search, slice.page, sortParam, dirParam);

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Bán hàng"
        title="Nhóm tuỳ chọn"
        action={
          <Button
            href={`/admin/products/modifier-groups/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            variant="primary"
          >
            Tạo
          </Button>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search)}
        search={
          <div className="shrink-0 w-full md:w-64">
            <Field label="Tìm nhóm tuỳ chọn" htmlFor="modifier-groups-search">
              <TextInput
                id="modifier-groups-search"
                placeholder="Ví dụ: Mức đường"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
        }
      >
        {null}
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(r) => r.group.id}
        getName={(r) => r.group.name}
        getHref={(r) =>
          `/admin/products/modifier-groups/${encodeURIComponent(r.group.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        phoneRow={(r) => ({
          title: r.group.name,
          value: `${formatNumber(r.productCount)} món`,
          meta: [
            r.group.selection_mode === "ONE" ? "Chọn một" : "Chọn nhiều",
            r.group.max_total ? `tối đa ${r.group.max_total} phần` : null,
            r.optionNames.length > 0
              ? `${r.optionNames.length} tuỳ chọn: ${r.optionNames.join(", ")}`
              : "Chưa có tuỳ chọn",
          ]
            .filter(Boolean)
            .join(" · "),
          badge:
            r.group.status === "ACTIVE" ? undefined : (
              <Badge variant="neutral">Ngừng dùng</Badge>
            ),
        })}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, 1, k, d),
        }}
        empty={
          <EmptyState
            icon="🎛️"
            title="Chưa có nhóm tuỳ chọn nào"
            description="Thêm nhóm tuỳ chọn để gom các lựa chọn như đường, đá, topping cho món."
          />
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="nhóm tuỳ chọn"
            pageHref={(p) => listUrl(search, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
