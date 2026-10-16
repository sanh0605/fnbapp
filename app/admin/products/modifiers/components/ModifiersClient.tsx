"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
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
import { deleteModifierAction } from "@/app/admin/products/modifiers/actions";
import type { DBModifier, DBModifierGroup } from "@/types/db";

interface ModifiersClientProps {
  modifiers: DBModifier[];
  toppings: any[];
  groups?: DBModifierGroup[];
  initialSearch?: string;
  initialPage?: string;
  canDelete?: boolean;
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
  return qs ? `/admin/products/modifiers?${qs}` : "/admin/products/modifiers";
}

export default function ModifiersClient({
  modifiers,
  toppings,
  groups,
  initialSearch = "",
  initialPage,
  canDelete = false,
}: ModifiersClientProps) {
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

  const groupsById = useMemo(
    () => new Map((groups || []).map((g) => [g.id, g])),
    [groups],
  );

  const getGroupName = (m: DBModifier): string => {
    return groupsById.get(m.group_id)?.name ?? "—";
  };

  const toppingById = useMemo(
    () => new Map(toppings.map((t: any) => [t.id, t])),
    [toppings],
  );

  const isStandaloneModifier = (m: DBModifier): boolean => {
    if (!m.product_id) return false;
    const topping = toppingById.get(m.product_id);
    return Boolean(topping && topping.status === "ACTIVE");
  };

  const columns: DataColumn<DBModifier>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (m) => m.id,
        render: (m) => (
          <span className="font-mono text-xs text-primary">
            {m.id}
          </span>
        ),
      },
      {
        key: "group",
        header: "Nhóm",
        sortValue: (m) => getGroupName(m),
        render: (m) => (
          <span className="text-text-secondary text-sm">
            {getGroupName(m)}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên tuỳ chọn",
        sortValue: (m) => m.name,
        render: (m) => (
          <div>
            <div className="text-text-primary">{m.name}</div>
            {m.status === "INACTIVE" && (
              <Badge variant="neutral" className="mt-1">
                Ngừng dùng
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "price",
        header: "Giá thêm",
        align: "right",
        sortValue: (m) => Number(m.price) || 0,
        render: (m) => (
          <span className="text-text-primary text-sm tabular-nums">
            {formatNumber(m.price)}
          </span>
        ),
      },
      {
        key: "standalone",
        header: "Bán độc lập",
        sortValue: (m) => (isStandaloneModifier(m) ? "Có" : "Không"),
        render: (m) => (
          <span className="text-text-secondary text-sm">
            {isStandaloneModifier(m) ? "Có" : "Không"}
          </span>
        ),
      },
    ],
    [toppingById],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredModifiers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return modifiers.filter((m) => {
      if (!q) return true;
      const matchName = (m.name || "").toLocaleLowerCase("vi").includes(q);
      const matchGroup = getGroupName(m).toLocaleLowerCase("vi").includes(q);
      const matchId = (m.id || "").toLocaleLowerCase("vi").includes(q);
      return matchName || matchGroup || matchId;
    });
  }, [modifiers, search, getGroupName]);

  const sortedModifiers = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredModifiers, col.sortValue, sortDir)
      : filteredModifiers;
  }, [filteredModifiers, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedModifiers, page);
  }, [sortedModifiers, page]);

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

  const removal = {
    verb: "Xoá",
    confirmMessage: (count: number) => `Xoá ${count} tuỳ chọn?`,
    remove: async (id: string) => {
      const fd = new FormData();
      fd.append("id", id);
      const res = await deleteModifierAction(fd);
      if (res?.error) {
        return { error: res.error };
      }
      return {};
    },
  };

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Món"
        title="Topping & tuỳ chọn"
        action={
          <Button
            href={`/admin/products/modifiers/new?returnTo=${encodeURIComponent(currentListUrl)}`}
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
      >
        <div className="shrink-0 w-full md:w-64">
          <Field label="Tìm tuỳ chọn" htmlFor="modifiers-search">
            <TextInput
              id="modifiers-search"
              placeholder="Ví dụ: Trân châu trắng"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(m) => m.id}
        getName={(m) => m.name}
        getHref={(m) =>
          `/admin/products/modifiers/${encodeURIComponent(m.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        phoneRow={(m) => ({
          title: m.name,
          value: formatNumber(m.price),
          meta: [
            getGroupName(m),
            m.id,
            `Bán độc lập: ${isStandaloneModifier(m) ? "Có" : "Không"}`,
          ]
            .filter(Boolean)
            .join(" · "),
          badge:
            m.status === "INACTIVE" ? (
              <Badge variant="neutral">Ngừng dùng</Badge>
            ) : undefined,
        })}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, 1, k, d),
        }}
        removal={canDelete ? removal : undefined}
        empty={
          <EmptyState
            icon="🧋"
            title="Chưa có tuỳ chọn nào"
            description="Thêm tuỳ chọn để phục vụ việc chọn topping hoặc biến thể cho món."
          />
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="tuỳ chọn"
            pageHref={(p) => listUrl(search, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
