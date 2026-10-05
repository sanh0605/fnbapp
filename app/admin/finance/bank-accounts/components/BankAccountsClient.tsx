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
import { setBankAccountStatus } from "@/app/admin/finance/bank-accounts/actions";
import type { DBBankAccount } from "@/types/db";

export interface BankAccountsClientProps {
  accounts: DBBankAccount[];
  canDelete?: boolean;
  initialSearch?: string;
  initialStatus?: string;
  initialPage?: string;
}

const VALID_STATUSES = ["ACTIVE", "INACTIVE", "ALL"] as const;
type BankAccountStatusFilter = (typeof VALID_STATUSES)[number];

function parseStatus(raw: string | null | undefined): BankAccountStatusFilter {
  if (raw === "INACTIVE" || raw === "ALL") return raw;
  return "ACTIVE";
}

function display(value: string | null | undefined): string {
  return value && value.length > 0 ? value : "—";
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
  return qs ? `/admin/finance/bank-accounts?${qs}` : "/admin/finance/bank-accounts";
}

export default function BankAccountsClient({
  accounts,
  initialSearch,
  initialStatus,
  initialPage,
}: BankAccountsClientProps): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawSort = searchParams?.get("sort");
  const rawDir = searchParams?.get("dir");

  const [search, setSearch] = useState(
    () => initialSearch ?? searchParams?.get("q") ?? "",
  );
  const [status, setStatus] = useState<BankAccountStatusFilter>(() =>
    parseStatus(initialStatus ?? searchParams?.get("status")),
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
    if (initialStatus !== undefined) setStatus(parseStatus(initialStatus));
    else if (searchParams?.get("status") !== null)
      setStatus(parseStatus(searchParams?.get("status")));
  }, [initialStatus, searchParams]);

  useEffect(() => {
    if (initialPage !== undefined) setPage(initialPage);
    else if (searchParams?.get("page") !== null)
      setPage(searchParams?.get("page") || undefined);
  }, [initialPage, searchParams]);

  const columns: DataColumn<DBBankAccount>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã",
        sortValue: (a) => a.id,
        render: (a) => (
          <span className="font-mono text-[11px] text-text-muted font-bold group-hover:text-primary transition-colors">
            {a.id}
          </span>
        ),
      },
      {
        key: "name",
        header: "Tên",
        sortValue: (a) => a.name,
        render: (a) => (
          <div className="font-bold text-text-primary">{a.name}</div>
        ),
      },
      {
        key: "bank",
        header: "Ngân hàng",
        sortValue: (a) => a.bank_name || "",
        render: (a) => (
          <span className="text-text-secondary">{display(a.bank_name)}</span>
        ),
      },
      {
        key: "number",
        header: "Số tài khoản",
        sortValue: (a) => a.account_number || "",
        render: (a) => (
          <span className="text-text-secondary">{display(a.account_number)}</span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        sortValue: (a) => (a.status === "ACTIVE" ? "Đang dùng" : "Ngừng dùng"),
        render: (a) =>
          a.status === "ACTIVE" ? (
            <Badge variant="success">Đang dùng</Badge>
          ) : (
            <Badge variant="warning">Ngừng dùng</Badge>
          ),
      },
    ],
    [],
  );

  const validSortKeys = useMemo(() => columns.map((c) => c.key), [columns]);
  // Default sort is code (id), descending
  const { key: sortKey, dir: sortDir } = parseSort(rawSort, rawDir, validSortKeys, "id");
  const sortParam = rawSort ? sortKey : undefined;
  const dirParam = rawSort ? sortDir : undefined;

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("vi");
    return accounts.filter((account) => {
      const matchStatus =
        status === "ALL" ||
        (status === "ACTIVE"
          ? account.status === "ACTIVE"
          : account.status !== "ACTIVE");
      if (!matchStatus) return false;

      if (q) {
        const matchName = (account.name || "").toLocaleLowerCase("vi").includes(q);
        const matchBank = (account.bank_name || "").toLocaleLowerCase("vi").includes(q);
        const matchNumber = (account.account_number || "").toLocaleLowerCase("vi").includes(q);
        const matchId = (account.id || "").toLocaleLowerCase("vi").includes(q);
        return matchName || matchBank || matchNumber || matchId;
      }
      return true;
    });
  }, [accounts, search, status]);

  const sortedAccounts = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    return col?.sortValue
      ? sortRows(filteredAccounts, col.sortValue, sortDir)
      : filteredAccounts;
  }, [filteredAccounts, columns, sortKey, sortDir]);

  const slice = useMemo(() => {
    return paginate(sortedAccounts, page);
  }, [sortedAccounts, page]);

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

  const renderCard = (account: DBBankAccount) => (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-bold text-text-primary text-base leading-tight">
            {account.name}
          </div>
          <div className="text-[11px] text-text-muted mt-0.5 font-mono">
            {account.id}
          </div>
        </div>
        <div className="shrink-0">
          {account.status === "ACTIVE" ? (
            <Badge variant="success">Đang dùng</Badge>
          ) : (
            <Badge variant="warning">Ngừng dùng</Badge>
          )}
        </div>
      </div>
      <div className="text-xs text-text-secondary pt-1 border-t border-border/50 flex flex-col gap-1">
        <div className="flex justify-between">
          <span className="text-text-muted">Ngân hàng:</span>
          <span>{display(account.bank_name)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">Số tài khoản:</span>
          <span>{display(account.account_number)}</span>
        </div>
      </div>
    </div>
  );

  const removal =
    status === "ACTIVE"
      ? {
          verb: "Ngừng dùng",
          confirmMessage: (count: number) =>
            `Ngừng dùng ${count} tài khoản? Tài khoản sẽ không còn hiện khi ghi khoản thu chi mới, nhưng các dòng đã ghi vẫn giữ nguyên.`,
          remove: async (id: string) => {
            const fd = new FormData();
            fd.set("id", id);
            fd.set("status", "INACTIVE");
            const res = await setBankAccountStatus(fd);
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
        group="Thu chi"
        title="Tài khoản ngân hàng"
        action={
          <Link
            href={`/admin/finance/bank-accounts/new?returnTo=${encodeURIComponent(currentListUrl)}`}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg font-medium hover:bg-primary-hover transition w-full md:w-auto text-center inline-flex items-center justify-center min-h-[44px] shadow-sm"
          >
            + Thêm tài khoản
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
            htmlFor="bank-accounts-search"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Tìm tài khoản
          </label>
          <input
            id="bank-accounts-search"
            type="text"
            placeholder="Tên, ngân hàng, số hoặc mã..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          />
        </div>
        <div className="shrink-0 flex-1 md:flex-none w-full md:w-48">
          <label
            htmlFor="bank-accounts-status"
            className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1"
          >
            Trạng thái
          </label>
          <select
            id="bank-accounts-status"
            value={status}
            onChange={(e) => setStatus(parseStatus(e.target.value))}
            className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-focus-ring outline-none bg-surface-card"
          >
            <option value="ACTIVE">Đang dùng</option>
            <option value="INACTIVE">Ngừng dùng</option>
            <option value="ALL">Tất cả</option>
          </select>
        </div>
      </FilterCard>

      <DataList
        rows={slice.rows}
        getId={(a) => a.id}
        getName={(a) => a.name}
        getHref={(a) =>
          `/admin/finance/bank-accounts/${encodeURIComponent(a.id)}?returnTo=${encodeURIComponent(currentListUrl)}`
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
              Không có tài khoản nào khớp bộ lọc
            </div>
            {Boolean(search || status !== "ACTIVE") && (
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
            unit="tài khoản"
            pageHref={(p) => listUrl(search, status, p, sortParam, dirParam)}
          />
        </div>
      )}
    </div>
  );
}
