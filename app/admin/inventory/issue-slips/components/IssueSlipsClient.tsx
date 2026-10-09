"use client";

import { useMemo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Select } from "@/components/ui/Select";
import { DateRangeButton } from "@/components/ui/DateRangeButton";
import { ListPageHeader } from "@/components/ui/list/ListPageHeader";
import { FilterCard } from "@/components/ui/list/FilterCard";
import { ListPagination } from "@/components/ui/list/ListPagination";
import { DataList, type DataColumn } from "@/components/ui/list/DataList";
import { formatNumber } from "@/lib/shared/format";
import { useFilterForm } from "@/lib/shared/use-filter-form";
import {
  formatRangeButtonText,
  writeRangeParams,
  type RangeValue,
} from "@/lib/shared/date-range-params";
import type {
  IssueSlipListPage,
  IssueSlipListRow,
  IssueSlipKind,
} from "@/lib/stock/issue-slip-list";

function formatEmptyRangePart(range: RangeValue): string {
  const text = formatRangeButtonText(range);
  const [preset, ...rest] = text.split(" · ");
  return `${preset} (${rest.join(" · ")})`;
}

export interface IssueSlipsClientProps {
  pageData: IssueSlipListPage;
  range: RangeValue;
  today: string;
  searching?: boolean;
}

function renderKindBadge(kind: IssueSlipKind, reason: string) {
  if (kind === "SLIP") {
    return (
      <Badge variant="neutral">
        {reason ? `Phiếu xuất · ${reason}` : "Phiếu xuất"}
      </Badge>
    );
  }
  if (kind === "STOCKTAKE") {
    return (
      <Badge variant="processing">
        Kiểm kê
      </Badge>
    );
  }
  if (kind === "CANCELLED") {
    return (
      <Badge variant="neutral">
        Đã huỷ
      </Badge>
    );
  }
  return null;
}

export default function IssueSlipsClient({
  pageData,
  range,
  today,
  searching = false,
}: IssueSlipsClientProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();


  const defaultFilters = { q: "", kind: "ALL", person: "ALL", page: "1" };
  const { draft, setField, applyFilters, isPending } = useFilterForm(defaultFilters);

  const hasAnyFilter = Boolean(
    searchParams.get("q") ||
      (searchParams.get("kind") && searchParams.get("kind") !== "ALL") ||
      (searchParams.get("person") && searchParams.get("person") !== "ALL") ||
      (searchParams.get("range") && searchParams.get("range") !== "THIS_MONTH") ||
      searchParams.get("from") ||
      searchParams.get("to")
  );
  const draftChanged =
    draft.q !== defaultFilters.q ||
    draft.kind !== defaultFilters.kind ||
    draft.person !== defaultFilters.person;
  const showClear = hasAnyFilter || draftChanged;

  function handleApply() {
    applyFilters({ page: "1" });
  }

  function handleClear() {
    setField("q", "");
    setField("kind", "ALL");
    setField("person", "ALL");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("range");
    params.delete("from");
    params.delete("to");
    params.delete("q");
    params.delete("kind");
    params.delete("person");
    params.delete("page");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  function handleDateRangeChange(nextRange: RangeValue) {
    const params = new URLSearchParams(searchParams.toString());
    writeRangeParams(params, nextRange);
    params.delete("page");
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }

  const { page, pageCount, firstIndex, lastIndex, total, rows, rangeError, people } = pageData;

  const currentListUrl = searchParams.toString()
    ? `/admin/inventory/issue-slips?${searchParams.toString()}`
    : "/admin/inventory/issue-slips";

  function getRowHref(row: IssueSlipListRow): string {
    if (row.href.startsWith("/admin/inventory/issue-slips/")) {
      return `${row.href}?returnTo=${encodeURIComponent(currentListUrl)}`;
    }
    return row.href;
  }

  function getPageUrl(pageNum: number): string {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(pageNum));
    return `?${params.toString()}`;
  }

  const columns: DataColumn<IssueSlipListRow>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Mã phiếu",
        render: (row) => (
          <span className="font-mono text-xs text-primary transition-colors">
            {row.id}
          </span>
        ),
      },
      {
        key: "dateText",
        header: "Ngày xuất",
        render: (row) => (
          <span className="tabular-nums text-text-primary">{row.dateText}</span>
        ),
      },
      {
        key: "kind",
        header: "Loại",
        render: (row) => renderKindBadge(row.kind, row.reason),
      },
      {
        key: "createdByName",
        header: "Người ghi",
        render: (row) => (
          <span className="text-text-primary">{row.createdByName}</span>
        ),
      },
      {
        key: "value",
        header: "Giá trị",
        align: "right",
        render: (row) => (
          <span className="tabular-nums text-text-primary">
            {formatNumber(row.value)}đ
          </span>
        ),
      },
    ],
    []
  );

  const renderCard = (row: IssueSlipListRow) => (
    <div>
      <div className="flex justify-between items-start gap-2 mb-2">
        <span className="font-mono text-xs text-primary">{row.id}</span>
        <span className="text-text-primary text-base tabular-nums font-normal">
          {formatNumber(row.value)}đ
        </span>
      </div>
      <div className="flex justify-between items-center gap-2">
        <div className="text-xs text-text-secondary">
          {row.dateText} · {row.createdByName}
        </div>
        <div>{renderKindBadge(row.kind, row.reason)}</div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <ListPageHeader
        group="Kho"
        title="Phiếu xuất"
        action={
          <Button
            href="/admin/inventory/issue-slips/new"
            variant="primary"
            className="w-full md:w-auto"
          >
            Tạo
          </Button>
        }
      />

      <FilterCard
        onApply={handleApply}
        onClear={handleClear}
        showClear={showClear}
      >
        <div className="w-full md:w-auto shrink-0">
          <DateRangeButton
            value={range}
            today={today}
            onChange={handleDateRangeChange}
            disabled={searching}
            disabledHint="Đang tìm trên mọi ngày · xoá ô tìm để lọc theo ngày"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Field label="Tìm kiếm" htmlFor="search-input">
            <TextInput
              id="search-input"
              placeholder="Ví dụ: ISL-00088"
              value={draft.q}
              onChange={(e) => setField("q", e.target.value)}
            />
          </Field>
        </div>
        <div className="w-full md:w-40">
          <Field label="Loại" htmlFor="kind-select">
            <Select
              id="kind-select"
              value={draft.kind}
              onChange={(e) => setField("kind", e.target.value)}
            >
              <option value="ALL">Tất cả</option>
              <option value="SLIP">Phiếu xuất</option>
              <option value="STOCKTAKE">Kiểm kê</option>
              <option value="CANCELLED">Đã huỷ</option>
            </Select>
          </Field>
        </div>
        <div className="w-full md:w-48">
          <Field label="Người ghi" htmlFor="person-select">
            <Select
              id="person-select"
              value={draft.person}
              onChange={(e) => setField("person", e.target.value)}
            >
              <option value="ALL">Tất cả</option>
              {people.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </FilterCard>

      {isPending && <div className="text-text-muted text-sm animate-pulse">Đang tải...</div>}

      <div className={`transition-opacity ${isPending ? "opacity-50 pointer-events-none" : ""}`}>
        <DataList
          rows={rows}
          getId={(row) => row.id}
          getName={(row) => row.id}
          getHref={getRowHref}
          columns={columns}
          renderCard={renderCard}
          empty={
            <EmptyState
              icon={<span className="text-4xl">📦</span>}
              title={
                searching
                  ? "Không tìm thấy phiếu nào trên mọi ngày"
                  : `Không có phiếu nào trong ${formatEmptyRangePart(range)}`
              }
              action={{ label: "Xoá lọc", onClick: handleClear }}
            />
          }
        />

        {total > 0 && (
          <div className="rounded-2xl border border-border overflow-hidden shadow-sm mt-4">
            <ListPagination
              slice={{ page, pageCount, firstIndex, lastIndex, total }}
              unit="phiếu"
              pageHref={getPageUrl}
            />
          </div>
        )}
      </div>
    </div>
  );
}
