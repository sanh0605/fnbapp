"use client";

import { useMemo } from "react";
import { DateRangeUrlButton } from "@/components/ui/DateRangeUrlButton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableRowHeader,
  TableCell,
} from "@/components/ui/Table";
import { formatNumber } from "@/lib/shared/format";
import { formatMonthLabel } from "@/lib/shared/datetime";
import type { CashBookMonth } from "@/lib/finance/cash-book-months";
import type { RangeValue } from "@/lib/shared/date-range-params";

export interface CashBookMonthsClientProps {
  months: CashBookMonth[];
  range: RangeValue;
  today: string;
}

function money(value: number): string {
  return `${formatNumber(value)}đ`;
}

interface GroupSummary {
  key: string;
  name: string;
}

function SideTable({
  title,
  sideKey,
  incomeGroups,
  expenseGroups,
  months,
}: {
  title: string;
  sideKey: "cash" | "bank";
  incomeGroups: GroupSummary[];
  expenseGroups: GroupSummary[];
  months: CashBookMonth[];
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <h3 className="text-base font-bold text-text-primary">{title}</h3>
      <Table statement>
        <TableHead>
          <TableHeaderCell stick="left">Khoản</TableHeaderCell>
          {months.map((m) => (
            <TableHeaderCell key={m.month} aria-label={m.month}>
              {formatMonthLabel(m.month)}
            </TableHeaderCell>
          ))}
        </TableHead>
        <TableBody>
          <TableRow look="strong">
            <TableRowHeader stick="left">Đầu kỳ</TableRowHeader>
            {months.map((m) => (
              <TableCell key={m.month} align="right">
                {money(m[sideKey].opening)}
              </TableCell>
            ))}
          </TableRow>
          <TableRow>
            <TableRowHeader stick="left">Thu bán hàng</TableRowHeader>
            {months.map((m) => (
              <TableCell key={m.month} align="right">
                {money(m[sideKey].salesIncome)}
              </TableCell>
            ))}
          </TableRow>
          {incomeGroups.map((group) => (
            <TableRow key={group.key}>
              <TableRowHeader stick="left" indent>
                {group.name}
              </TableRowHeader>
              {months.map((m) => {
                const item = m[sideKey].handIncome.find((g) => g.key === group.key);
                return (
                  <TableCell key={m.month} align="right">
                    {item ? money(item.total) : "–"}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          <TableRow>
            <TableRowHeader stick="left">Chi nhập hàng</TableRowHeader>
            {months.map((m) => (
              <TableCell key={m.month} align="right">
                {money(m[sideKey].purchaseExpense)}
              </TableCell>
            ))}
          </TableRow>
          {expenseGroups.map((group) => (
            <TableRow key={group.key}>
              <TableRowHeader stick="left" indent>
                {group.name}
              </TableRowHeader>
              {months.map((m) => {
                const item = m[sideKey].handExpense.find((g) => g.key === group.key);
                return (
                  <TableCell key={m.month} align="right">
                    {item ? money(item.total) : "–"}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
          <TableRow look="strong">
            <TableRowHeader stick="left">Cuối kỳ</TableRowHeader>
            {months.map((m) => (
              <TableCell key={m.month} align="right">
                {money(m[sideKey].closing)}
              </TableCell>
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </section>
  );
}

function extractGroups(months: CashBookMonth[], side: "cash" | "bank") {
  const incMap = new Map<string, string>();
  const expMap = new Map<string, string>();
  for (const m of months) {
    for (const g of m[side].handIncome) {
      if (!incMap.has(g.key)) incMap.set(g.key, g.name);
    }
    for (const g of m[side].handExpense) {
      if (!expMap.has(g.key)) expMap.set(g.key, g.name);
    }
  }
  return {
    income: Array.from(incMap.entries()).map(([key, name]) => ({ key, name })),
    expense: Array.from(expMap.entries()).map(([key, name]) => ({ key, name })),
  };
}

export default function CashBookMonthsClient({
  months,
  range,
  today,
}: CashBookMonthsClientProps) {
  const filteredMonths = useMemo(() => {
    return months.filter(
      (m) => m.month >= range.start && m.month <= range.end,
    );
  }, [months, range.start, range.end]);
  const cashGroups = useMemo(() => extractGroups(filteredMonths, "cash"), [filteredMonths]);
  const bankGroups = useMemo(() => extractGroups(filteredMonths, "bank"), [filteredMonths]);

  const lastMonth =
    filteredMonths.length > 0
      ? filteredMonths[filteredMonths.length - 1]
      : null;

  return (
    <div className="space-y-6">
      {/* Report frame header: title and month range bar (BR-UI-017) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Báo cáo theo tháng</h2>
          <p className="text-xs text-text-secondary">
            Đơn vị: đồng · theo tháng dương lịch
          </p>
        </div>
        <DateRangeUrlButton mode="month" value={range} today={today} />
      </div>

      {filteredMonths.length === 0 ? (
        <EmptyState
          title={`Từ ${formatMonthLabel(range.start)} đến ${formatMonthLabel(range.end)} chưa có số liệu nào.`}
        />
      ) : (
        <>
          {/* Headline figures: Tiền mặt and Ngân hàng Cuối kỳ of the last month in range */}
          {lastMonth && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-text-muted">
                    Tiền mặt cuối kỳ
                  </span>
                  <span className="text-xs text-text-muted">
                    Tháng {formatMonthLabel(lastMonth.month)}
                  </span>
                </div>
                <div
                  data-testid="headline-closing-cash"
                  className={`text-2xl font-bold tabular-nums ${
                    lastMonth.cash.closing < 0 ? "text-danger" : "text-text-primary"
                  }`}
                >
                  {money(lastMonth.cash.closing)}
                </div>
                {lastMonth.cash.closing < 0 && (
                  <div className="text-xs text-warning pt-1">
                    sổ chưa ghi tiền gửi ngân hàng
                  </div>
                )}
              </div>
              <div className="bg-surface-card rounded-2xl border border-border p-4 shadow-sm space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-semibold text-text-muted">
                    Ngân hàng cuối kỳ
                  </span>
                  <span className="text-xs text-text-muted">
                    Tháng {formatMonthLabel(lastMonth.month)}
                  </span>
                </div>
                <div
                  data-testid="headline-closing-bank"
                  className={`text-2xl font-bold tabular-nums ${
                    lastMonth.bank.closing < 0 ? "text-danger" : "text-text-primary"
                  }`}
                >
                  {money(lastMonth.bank.closing)}
                </div>
              </div>
            </div>
          )}

          {/* One table per side (Tiền mặt, Ngân hàng) */}
          <div className="space-y-6">
            <div className="overflow-hidden rounded-xl border border-border bg-surface-card p-4 shadow-sm">
              <SideTable
                title="Tiền mặt"
                sideKey="cash"
                incomeGroups={cashGroups.income}
                expenseGroups={cashGroups.expense}
                months={filteredMonths}
              />
            </div>
            <div className="overflow-hidden rounded-xl border border-border bg-surface-card p-4 shadow-sm">
              <SideTable
                title="Ngân hàng"
                sideKey="bank"
                incomeGroups={bankGroups.income}
                expenseGroups={bankGroups.expense}
                months={filteredMonths}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
