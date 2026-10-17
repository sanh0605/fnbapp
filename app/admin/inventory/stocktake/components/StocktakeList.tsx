"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { formatNumber } from "@/lib/shared/format";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { TextInput } from "@/components/ui/TextInput";
import {
  startStocktakeSession,
  type StocktakeListRow,
} from "../actions";

export type StocktakeListRowItem = StocktakeListRow & {
  login?: string;
};

export function formatStocktakeDiffValue(row: StocktakeListRow): string {
  if (row.status === "REVERSED" || (row.shortValue === null && row.foundValue === null)) {
    return "—";
  }
  const parts: string[] = [];
  if (row.shortValue !== null && row.shortValue > 0) {
    parts.push(`thiếu ${formatNumber(row.shortValue)}đ`);
  }
  if (row.foundValue !== null && row.foundValue > 0) {
    parts.push(`thừa ${formatNumber(row.foundValue)}đ`);
  }
  let text = parts.length > 0 ? parts.join(" · ") : "0đ";
  if (row.status === "OPEN") {
    text = `${text} (tạm tính)`;
  }
  return text;
}

export function renderStocktakeStatusBadge(status: StocktakeListRow["status"]) {
  if (status === "OPEN") {
    return <Badge variant="warning">Đang đếm</Badge>;
  }
  if (status === "CONFIRMED") {
    return <Badge variant="success">Đã xác nhận</Badge>;
  }
  if (status === "REVERSED") {
    return <Badge variant="neutral">Đã hoàn tác</Badge>;
  }
  return null;
}

export function StocktakeList({ sessions }: { sessions: StocktakeListRowItem[] }) {
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const openSession = sessions.find((s) => s.status === "OPEN");
  const hasOpen = Boolean(openSession);

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((row) => {
      const matchName = (row.personName || "").toLowerCase().includes(q);
      const matchLogin = (row.login || (row as any).createdByName || (row as any).created_by_name || "").toLowerCase().includes(q);
      const matchId = (row.id || "").toLowerCase().includes(q);
      return matchName || matchLogin || matchId;
    });
  }, [sessions, search]);

  async function handleStart() {
    setIsStarting(true);
    setError(null);
    const res = await startStocktakeSession();
    setIsStarting(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  const columns: DataColumn<StocktakeListRow>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã phiên",
        render: (row) => (
          <span className="font-mono text-primary">{row.id}</span>
        ),
      },
      {
        key: "at",
        header: "Thời gian",
        render: (row) => (
          <span className="tabular-nums">{formatDateTimeFull(row.at)}</span>
        ),
      },
      {
        key: "status",
        header: "Trạng thái",
        render: (row) => renderStocktakeStatusBadge(row.status),
      },
      {
        key: "personName",
        header: "Người thực hiện",
        render: (row) => <span>{row.personName}</span>,
      },
      {
        key: "countedLines",
        header: "Đã đếm",
        align: "right",
        render: (row) => (
          <span className="tabular-nums">
            {row.countedLines}/{row.totalLines}
          </span>
        ),
      },
      {
        key: "diffValue",
        header: "Giá trị lệch",
        align: "right",
        render: (row) => (
          <span className="tabular-nums">{formatStocktakeDiffValue(row)}</span>
        ),
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <ListPageHeader
        group="Kho"
        title="Kiểm kê"
        action={
          hasOpen && openSession ? (
            <div className="flex flex-col items-start md:items-end gap-1">
              <Button
                variant="primary"
                disabled={true}
              >
                Tạo phiên kiểm kê
              </Button>
              <span className="text-xs text-text-secondary">
                Đang có phiên{" "}
                <Link
                  href={`/admin/inventory/stocktake/${openSession.id}`}
                  className="text-primary hover:underline font-mono"
                >
                  {openSession.id}
                </Link>{" "}
                chưa xác nhận
              </span>
            </div>
          ) : (
            <Button
              variant="primary"
              loading={isStarting}
              onClick={handleStart}
            >
              Tạo phiên kiểm kê
            </Button>
          )
        }
      />

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="max-w-xs">
        <TextInput
          aria-label="Tìm kiếm"
          placeholder="Tìm theo mã hoặc người thực hiện"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <DataList
        rows={filteredSessions}
        getId={(row) => row.id}
        getName={(row) => row.id}
        getHref={(row) => `/admin/inventory/stocktake/${row.id}`}
        columns={columns}
        phoneRow={(row) => ({
          title: formatDateTimeFull(row.at),
          value: formatStocktakeDiffValue(row).replace(" (tạm tính)", ""),
          meta: [
            row.status === "OPEN" ? "Tạm tính" : null,
            row.id,
            row.personName,
            `Đã đếm ${row.countedLines}/${row.totalLines}`,
          ]
            .filter(Boolean)
            .join(" · "),
          badge: renderStocktakeStatusBadge(row.status),
        })}
        empty={
          <EmptyState
            icon="📋"
            title="Chưa có phiên kiểm kê nào"
            description="Bắt đầu phiên kiểm kê đầu tiên để đối chiếu tồn kho thực tế với sổ sách."
            action={
              !hasOpen
                ? {
                    label: "Tạo phiên kiểm kê",
                    onClick: handleStart,
                  }
                : undefined
            }
          />
        }
      />
    </div>
  );
}
