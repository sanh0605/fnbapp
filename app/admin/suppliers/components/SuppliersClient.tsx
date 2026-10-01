"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { deleteSupplierAction } from "../actions";
import type { DBSupplier } from "@/types/db";

interface SuppliersClientProps {
  suppliers: DBSupplier[];
  // ADMIN only (BR-ACCESS-003) -- everyone else may add and edit.
  canDelete: boolean;
  initialSearch: string;
  initialPage?: string;
}

function listUrl(search: string, page: number = 1): string {
  const p = new URLSearchParams();
  if (search) p.set("q", search);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/admin/suppliers?${qs}` : "/admin/suppliers";
}

export default function SuppliersClient({
  suppliers,
  canDelete,
  initialSearch,
  initialPage,
}: SuppliersClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [page, setPage] = useState<string | number | undefined>(initialPage);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase();
    return suppliers.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q)
      );
    });
  }, [suppliers, search]);

  const slice = useMemo(() => {
    return paginate(filteredSuppliers, page);
  }, [filteredSuppliers, page]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setSearch(next);
    setPage(1);
    router.replace(listUrl(next, 1), { scroll: false });
  };

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, 1), { scroll: false });
  };

  const handleClearFilter = () => {
    setSearch("");
    setPage(1);
    router.replace(listUrl("", 1), { scroll: false });
  };

  const currentListUrl = listUrl(search, slice.page);

  const columns: DataColumn<DBSupplier>[] = [
    {
      key: "id",
      header: "Mã",
      render: (s) => (
        <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
          {s.id}
        </span>
      ),
    },
    {
      key: "name",
      header: "Tên",
      render: (s) => (
        <div>
          <div className="font-bold text-text-primary">{s.name}</div>
          {s.status === "INACTIVE" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-secondary mt-1 border border-border">
              Ngừng hợp tác
            </span>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      header: "Điện thoại",
      render: (s) => (
        <span className="text-text-primary font-medium">{s.phone || "—"}</span>
      ),
    },
    {
      key: "address",
      header: "Địa chỉ",
      secondary: true,
      render: (s) => (
        <span className="text-text-secondary truncate max-w-[240px] block">
          {s.address || "—"}
        </span>
      ),
    },
    {
      key: "tax_id",
      header: "Mã số thuế",
      secondary: true,
      render: (s) => (
        <span className="font-mono text-text-secondary">{s.tax_id || "—"}</span>
      ),
    },
  ];

  const renderCard = (s: DBSupplier) => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-bold text-text-primary text-base leading-tight">
            {s.name}
          </div>
          <div className="font-mono text-[11px] text-text-muted mt-0.5 font-bold">
            {s.id}
          </div>
        </div>
        {s.status === "INACTIVE" && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-secondary border border-border shrink-0">
            Ngừng hợp tác
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1 text-sm text-text-secondary">
        {s.phone && (
          <div className="flex gap-2">
            <span className="text-text-muted shrink-0">LH:</span>
            <span className="text-text-primary font-medium">{s.phone}</span>
          </div>
        )}
        {s.tax_id && (
          <div className="flex gap-2">
            <span className="text-text-muted shrink-0">MST:</span>
            <span className="font-mono">{s.tax_id}</span>
          </div>
        )}
        {s.address && (
          <div className="flex gap-2">
            <span className="text-text-muted shrink-0">ĐC:</span>
            <span className="line-clamp-2">{s.address}</span>
          </div>
        )}
      </div>
    </div>
  );

  const removal = canDelete
    ? {
        verb: "Xoá",
        confirmMessage: (count: number) =>
          `Xoá ${count} nhà cung cấp đã chọn? Nhà cung cấp đã có phiếu nhập sẽ không bị xoá.`,
        remove: async (id: string) => {
          const fd = new FormData();
          fd.append("id", id);
          const res = await deleteSupplierAction(fd);
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
        group="Nhập hàng"
        title="Nhà cung cấp"
        action={
          <Link
            href={`/admin/suppliers/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            + Thêm nhà cung cấp
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
            htmlFor="suppliers-search"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Tìm kiếm
          </label>
          <input
            id="suppliers-search"
            type="text"
            placeholder="Tên, SĐT, địa chỉ..."
            value={search}
            onChange={handleSearchChange}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          />
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(s) => s.id}
        getName={(s) => s.name}
        getHref={(s) =>
          `/admin/suppliers/${encodeURIComponent(s.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={renderCard}
        removal={removal}
        empty={
          <EmptyState
            icon="🚚"
            title="Chưa có nhà cung cấp"
            description="Thêm nhà cung cấp để quản lý nguồn nhập hàng."
          />
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="nhà cung cấp"
            pageHref={(p) => listUrl(search, p)}
          />
        </div>
      )}
    </div>
  );
}
