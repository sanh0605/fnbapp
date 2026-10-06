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
import { formatDate } from "@/lib/shared/datetime";
import { deleteUserAction } from "@/app/admin/users/actions";
import { RoleBadge } from "./RoleBadge";
import type { DBUser } from "@/types/db";

export interface UsersClientProps {
  users: DBUser[];
  canDelete: boolean;
  initialSearch?: string;
  initialRole?: string;
  initialPage?: string;
}

const VALID_ROLES = ["ADMIN", "MANAGER", "STAFF"] as const;
type RoleFilter = "ALL" | (typeof VALID_ROLES)[number];

function parseRole(raw: string | null | undefined): RoleFilter {
  if (raw === "ADMIN" || raw === "MANAGER" || raw === "STAFF") return raw;
  return "ALL";
}

function listUrl(
  search: string,
  role: string,
  page: number = 1,
  sort?: string,
  dir?: string,
): string {
  const p = new URLSearchParams();
  const trimmed = search.trim();
  if (trimmed) p.set("q", trimmed);
  if (role && role !== "ALL") p.set("role", role);
  if (page > 1) p.set("page", String(page));
  if (sort) p.set("sort", sort);
  if (dir) p.set("dir", dir);
  const qs = p.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}

export default function UsersClient({
  users,
  canDelete,
  initialSearch,
  initialRole,
  initialPage,
}: UsersClientProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [search, setSearch] = useState(
    () => initialSearch ?? searchParams?.get("q") ?? "",
  );
  const [role, setRole] = useState<RoleFilter>(() =>
    parseRole(initialRole ?? searchParams?.get("role")),
  );
  const [page, setPage] = useState<string | number | undefined>(
    () => initialPage ?? searchParams?.get("page") ?? undefined,
  );

  useEffect(() => {
    if (initialSearch !== undefined) setSearch(initialSearch);
    else if (searchParams?.get("q") !== null)
      setSearch(searchParams?.get("q") || "");
  }, [initialSearch, searchParams]);

  useEffect(() => {
    if (initialRole !== undefined) setRole(parseRole(initialRole));
    else if (searchParams?.get("role") !== null)
      setRole(parseRole(searchParams?.get("role")));
  }, [initialRole, searchParams]);

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage);
    else if (searchParams?.get("page") !== null)
      setPage(searchParams?.get("page") || undefined);
  }, [initialPage, searchParams]);

  const columns: DataColumn<DBUser>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã NV",
        sortValue: (u) => u.id,
        render: (u) => (
          <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
            {u.id}
          </span>
        ),
      },
      {
        key: "username",
        header: "Tên đăng nhập",
        sortValue: (u) => u.username,
        render: (u) => (
          <div className="font-bold text-text-primary">{u.username}</div>
        ),
      },
      {
        key: "role",
        header: "Quyền hạn",
        sortValue: (u) => u.role,
        render: (u) => <RoleBadge role={u.role} />,
      },
      {
        key: "created",
        header: "Ngày tạo",
        sortValue: (u) => u.created_at || "",
        render: (u) => (
          <span className="text-text-muted">
            {u.created_at ? formatDate(u.created_at) : "—"}
          </span>
        ),
      },
    ],
    [],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  // Default sort is code (id), descending (newest code first)
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return users.filter((u) => {
      const matchRole = role === "ALL" || u.role === role;
      if (!matchRole) return false;

      if (q) {
        const matchUsername = (u.username || "").toLocaleLowerCase("vi").includes(q);
        const matchId = (u.id || "").toLocaleLowerCase("vi").includes(q);
        return matchUsername || matchId;
      }
      return true;
    });
  }, [users, search, role]);

  const sortedUsers = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredUsers, col.sortValue, sortDir)
      : filteredUsers;
  }, [filteredUsers, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedUsers, page);
  }, [sortedUsers, page]);

  const handleApplyFilter = () => {
    setPage(1);
    router.replace(listUrl(search, role, 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const handleClearFilter = () => {
    setSearch("");
    setRole("ALL");
    setPage(1);
    router.replace(listUrl("", "ALL", 1, sortParam, dirParam), {
      scroll: false,
    });
  };

  const currentListUrl = listUrl(search, role, slice.page, sortParam, dirParam);

  const renderCard = (u: DBUser) => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-bold text-text-primary text-base leading-tight">
            {u.username}
          </div>
          <div className="text-[11px] text-text-muted mt-0.5 font-mono">
            {u.id}
          </div>
        </div>
        <div className="shrink-0">
          <RoleBadge role={u.role} />
        </div>
      </div>
      <div className="text-xs text-text-secondary pt-1 border-t border-border/50 flex justify-between">
        <span className="text-text-muted">Ngày tạo:</span>
        <span>{u.created_at ? formatDate(u.created_at) : "—"}</span>
      </div>
    </div>
  );

  const removal = canDelete
    ? {
        verb: "Xoá",
        confirmMessage: (count: number) =>
          `Xoá ${count} nhân sự? Không thể hoàn tác.`,
        canRemove: (u: DBUser) => u.username !== "admin",
        remove: async (id: string) => {
          const fd = new FormData();
          fd.set("id", id);
          const res = await deleteUserAction(fd);
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
        group="Cài đặt"
        title="Nhân viên & quyền"
        action={
          <Link
            href={`/admin/users/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            Tạo
          </Link>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search || role !== "ALL")}
      >
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-64">
          <label
            htmlFor="users-search"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Tìm nhân sự
          </label>
          <input
            id="users-search"
            type="text"
            placeholder="Tên đăng nhập hoặc mã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-48">
          <label
            htmlFor="users-role"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Quyền hạn
          </label>
          <select
            id="users-role"
            value={role}
            onChange={(e) => setRole(parseRole(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ALL">Tất cả quyền</option>
            <option value="ADMIN">ADMIN</option>
            <option value="MANAGER">MANAGER</option>
            <option value="STAFF">STAFF</option>
          </select>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(u) => u.id}
        getName={(u) => u.username}
        getHref={(u) =>
          `/admin/users/${encodeURIComponent(u.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        renderCard={renderCard}
        sort={{
          key: sortKey,
          dir: sortDir,
          href: (k, d) => listUrl(search, role, 1, k, d),
        }}
        removal={removal}
        empty={
          <div className="bg-surface-card rounded-2xl border border-border p-8 text-center space-y-3">
            <div className="text-text-secondary text-sm">
              Không tìm thấy nhân sự
            </div>
            {Boolean(search || role !== "ALL") && (
              <div>
                <button
                  type="button"
                  onClick={handleClearFilter}
                  className="text-danger hover:underline font-medium text-sm min-h-[44px] inline-flex items-center"
                >
                  Xoá lọc
                </button>
              </div>
            )}
          </div>
        }
      />

      {slice.total > 0 && (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <ListPagination
            slice={slice}
            unit="nhân sự"
            pageHref={(p) => listUrl(search, role, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
