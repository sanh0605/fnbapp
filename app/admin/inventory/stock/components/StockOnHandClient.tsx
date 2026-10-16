"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { formatNumber, formatDecimal } from "@/lib/shared/format";
import { formatDate } from "@/lib/shared/datetime";
import { stripDiacritics } from "@/lib/shared/duplicate-name-guard";
import type { StockOnHandRow } from "@/lib/stock/stock-on-hand";

export interface StockOnHandClientProps {
  total: number;
  unpricedCount: number;
  rows: StockOnHandRow[];
  initialSearch?: string;
}

function renderDaysLeft(row: StockOnHandRow) {
  if (row.onHand < 0) return null;
  if (row.daysLeft === "OUT") {
    return <Badge variant="warning">Hết</Badge>;
  }
  if (typeof row.daysLeft === "number") {
    const text = `khoảng ${formatNumber(row.daysLeft)} ngày`;
    if (row.daysLeft <= 7) {
      return <Badge variant="warning">{text}</Badge>;
    }
    return <span className="text-text-secondary">{text}</span>;
  }
  return <span className="text-text-muted">—</span>;
}

export default function StockOnHandClient({
  total,
  unpricedCount,
  rows,
  initialSearch,
}: StockOnHandClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(() => initialSearch ?? searchParams?.get("q") ?? "");

  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
    else if (searchParams?.get("q") !== null) setSearch(searchParams?.get("q") || "");
  }, [initialSearch, searchParams]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setSearch(next);
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    if (next) p.set("q", next);
    else p.delete("q");
    const qs = p.toString();
    router.replace(qs ? `/admin/inventory/stock?${qs}` : "/admin/inventory/stock", { scroll: false });
  };

  const handleClear = () => {
    setSearch("");
    router.replace("/admin/inventory/stock", { scroll: false });
  };

  const filteredRows = useMemo(() => {
    const term = stripDiacritics(search.trim().toLowerCase());
    if (!term) return rows;
    return rows.filter((row) => {
      const name = stripDiacritics(row.name.toLowerCase());
      const id = stripDiacritics(row.itemId.toLowerCase());
      return name.includes(term) || id.includes(term);
    });
  }, [rows, search]);

  const caption = useMemo(() => {
    const base = "Theo sổ: đã nhập trừ đã xuất. Mỗi món đúng tới ngày kiểm gần nhất của nó.";
    if (unpricedCount > 0) {
      return `${base} Chưa gồm ${formatNumber(unpricedCount)} món không tính được giá.`;
    }
    return base;
  }, [unpricedCount]);

  const currentListUrl = useMemo(() => {
    return search ? `/admin/inventory/stock?q=${encodeURIComponent(search)}` : "/admin/inventory/stock";
  }, [search]);

  const columns: DataColumn<StockOnHandRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Tên",
        render: (row) => (
          <div>
            <div className="text-text-primary">{row.name}</div>
            {row.inactive && (
              <Badge variant="neutral" className="mt-1">
                Ngừng dùng
              </Badge>
            )}
          </div>
        ),
      },
      {
        key: "category",
        header: "Phân loại hàng",
        render: (row) => (
          <span className="text-text-secondary">{row.categoryName || "—"}</span>
        ),
      },
      {
        key: "onHand",
        header: "Tồn",
        align: "right",
        render: (row) => (
          <span className={row.onHand < 0 ? "text-danger tabular-nums" : "tabular-nums"}>
            {formatDecimal(row.onHand, { maxDigits: 2 })} {row.unitName}
          </span>
        ),
      },
      {
        key: "value",
        header: "Giá trị",
        align: "right",
        render: (row) => (
          <span className="tabular-nums">
            {row.value !== null ? `${formatNumber(Math.round(row.value))}đ` : "—"}
          </span>
        ),
      },
      {
        key: "daysLeft",
        header: "Đủ dùng",
        render: (row) => renderDaysLeft(row),
      },
      {
        key: "lastCountedAt",
        header: "Kiểm lần cuối",
        render: (row) => (
          <span className="text-text-secondary">
            {row.lastCountedAt ? formatDate(row.lastCountedAt) : "Chưa kiểm lần nào"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Kho"
        title="Tồn kho"
      />

      <div className="md:static sticky top-0 z-10 bg-surface-card rounded-2xl border border-border p-4 md:p-6 shadow-sm">
        <div className="text-sm font-medium text-text-secondary">
          Giá trị tồn kho
        </div>
        <div className="text-2xl md:text-3xl font-bold text-text-primary tabular-nums mt-1">
          {formatNumber(total)}đ
        </div>
        <p className="text-xs md:text-sm text-text-secondary mt-2">
          {caption}
        </p>
      </div>

      <FilterCard
        onApply={() => {}}
        onClear={handleClear}
        showClear={Boolean(search)}
        search={
          <div className="shrink-0 w-full md:w-80">
            <Field label="Tìm kiếm" htmlFor="stock-search">
              <TextInput
                id="stock-search"
                placeholder="Ví dụ: Trứng gà"
                value={search}
                onChange={handleSearchChange}
              />
            </Field>
          </div>
        }
      >
        {null}
      </FilterCard>

      <DataList
        rows={filteredRows}
        getId={(row) => row.itemId}
        getName={(row) => row.name}
        getHref={(row) =>
          `/admin/inventory/items/${encodeURIComponent(row.itemId)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        phoneRow={(row) => {
          const hasWarningBadge =
            !row.inactive &&
            row.onHand >= 0 &&
            (row.daysLeft === "OUT" || (typeof row.daysLeft === "number" && row.daysLeft <= 7));

          const badge = row.inactive ? (
            <Badge variant="neutral">Ngừng dùng</Badge>
          ) : hasWarningBadge ? (
            row.daysLeft === "OUT" ? (
              <Badge variant="warning">Hết</Badge>
            ) : (
              <Badge variant="warning">khoảng {formatNumber(row.daysLeft as number)} ngày</Badge>
            )
          ) : undefined;

          const daysText =
            hasWarningBadge || row.onHand < 0
              ? null
              : row.daysLeft === "OUT"
              ? "Hết"
              : typeof row.daysLeft === "number"
              ? `khoảng ${formatNumber(row.daysLeft)} ngày`
              : null;

          return {
            title: row.name,
            value: (
              <span className={row.onHand < 0 ? "text-danger" : ""}>
                {formatDecimal(row.onHand, { maxDigits: 2 })} {row.unitName}
              </span>
            ),
            meta: [
              row.value !== null ? `${formatNumber(Math.round(row.value))}đ` : null,
              daysText,
              row.categoryName || null,
              row.lastCountedAt ? `Kiểm lần cuối ${formatDate(row.lastCountedAt)}` : "Chưa kiểm lần nào",
            ]
              .filter(Boolean)
              .join(" · "),
            badge,
          };
        }}
        empty={
          <EmptyState
            icon={<span className="text-4xl">📦</span>}
            title="Không có món nào khớp"
            action={search ? { label: "Xoá lọc", onClick: handleClear } : undefined}
          />
        }
      />
    </div>
  );
}
