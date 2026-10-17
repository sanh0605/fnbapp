"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { paginate } from "@/components/ui/list/paginate";
import { sortRows, parseSort } from "@/components/ui/list/sort";
import { formatDate } from "@/lib/shared/datetime";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { deleteUserAction } from "@/app/admin/users/actions";
import { RoleBadge } from "./RoleBadge";
import { staffLabel } from "@/lib/auth/staff-names";
import type { DBUser } from "@/types/db";

export interface UsersClientProps {
  users: DBUser[];
  canDelete: boolean;
  canGrantAdmin?: boolean;
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
  canGrantAdmin = true,
  initialSearch,
  initialRole,
  initialPage,
}: UsersClientProps) {
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
          <span className="font-mono text-xs text-primary transition-colors">
            {u.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên nhân viên",
        sortValue: (u) => staffLabel(u).name,
        render: (u) => {
          const { name, showLogin } = staffLabel(u);
          return (
            <div>
              <div className="text-text-primary">{name}</div>
              {showLogin && (
                <div className="text-xs text-text-muted">{u.username}</div>
              )}
            </div>
          );
        },
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

  const validSortKeys = useMemo(
    () => [...columns.map((c) => c.key), "username"],
    [columns],
  );
  // Default sort is code (id), descending (newest code first)
  const { key: parsedKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortKey = parsedKey === "username" ? "name" : parsedKey;
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return users.filter((u) => {
      const matchRole = role === "ALL" || u.role === role;
      if (!matchRole) return false;

      if (q) {
        const matchName = (u.name || "").toLocaleLowerCase("vi").includes(q);
        const matchUsername = (u.username || "").toLocaleLowerCase("vi").includes(q);
        const matchId = (u.id || "").toLocaleLowerCase("vi").includes(q);
        return matchName || matchUsername || matchId;
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

  const appliedSearch = searchParams?.get("q") ?? initialSearch ?? "";
  const appliedRole = searchParams?.get("role") ?? initialRole ?? "ALL";
  const activeCount =
    (appliedSearch ? 1 : 0) +
    (appliedRole && appliedRole !== "ALL" ? 1 : 0);

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
          <Button
            href={`/admin/users/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            variant="primary"
          >
            Tạo
          </Button>
        }
      />

      <FilterCard
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        showClear={Boolean(search || role !== "ALL")}
        activeCount={activeCount}
        search={
          <div className="shrink-0 w-full md:w-64">
            <Field label="Tìm nhân sự" htmlFor="users-search">
              <TextInput
                id="users-search"
                placeholder="Ví dụ: nhanvien01"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>
        }
      >
        <div className="shrink-0 w-full md:w-48">
          <Field label="Quyền hạn" htmlFor="users-role">
            <Select
              id="users-role"
              value={role}
              onChange={(e) => setRole(parseRole(e.target.value))}
            >
              <option value="ALL">Tất cả quyền</option>
              <option value="ADMIN">Quản trị viên</option>
              <option value="MANAGER">Quản lý</option>
              <option value="STAFF">Nhân viên</option>
            </Select>
          </Field>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(u) => u.id}
        getName={(u) => staffLabel(u).name}
        getHref={(u) =>
          `/admin/users/${encodeURIComponent(u.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
        }
        columns={columns}
        phoneRow={(u) => {
          const { name, showLogin } = staffLabel(u);
          return {
            title: name,
            meta: [
              showLogin ? u.username : null,
              u.id,
              u.created_at ? `Tạo ${formatDate(u.created_at)}` : null,
            ]
              .filter(Boolean)
              .join(" · "),
            badge: <RoleBadge role={u.role} />,
          };
        }}
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
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleClearFilter}
                >
                  Xoá lọc
                </Button>
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
