"use client";

import {
  Table,
  TableHead,
  TableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableTotalRow,
} from "@/components/ui/Table";
import { formatNumber } from "@/lib/shared/format";
import type { IssueSlipDetail } from "@/lib/stock/issue-slip-detail";

export interface IssueSlipViewLinesProps {
  detail: IssueSlipDetail;
}

export function IssueSlipViewLines({ detail }: IssueSlipViewLinesProps): JSX.Element {
  return (
    <>
      {/* Desktop view */}
      <div className="hidden md:block">
        <Table>
          <TableHead>
            <TableHeaderCell>#</TableHeaderCell>
            <TableHeaderCell>Mặt hàng</TableHeaderCell>
            <TableHeaderCell align="right">Số lượng</TableHeaderCell>
            <TableHeaderCell align="right">Giá trị</TableHeaderCell>
          </TableHead>
          <TableBody>
            {detail.lines.map((l, i) => (
              <TableRow key={l.issueId}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{l.name}</TableCell>
                <TableCell align="right">{l.quantityText}</TableCell>
                <TableCell align="right">{formatNumber(l.value)}đ</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableTotalRow>
            <TableCell />
            <TableCell colSpan={2}>Tổng giá trị</TableCell>
            <TableCell align="right">{formatNumber(detail.totalValue)}đ</TableCell>
          </TableTotalRow>
        </Table>
      </div>

      {/* Mobile view */}
      <div className="md:hidden flex flex-col divide-y divide-border bg-surface-card border border-border rounded-xl overflow-hidden">
        {detail.lines.map((l) => (
          <div key={l.issueId} className="p-4 flex justify-between gap-3 bg-surface-card">
            <div className="flex flex-col gap-1">
              <span className="font-medium text-text-primary text-sm">{l.name}</span>
              <span className="text-xs text-text-secondary">{l.quantityText}</span>
            </div>
            <span className="font-normal text-sm tabular-nums whitespace-nowrap text-text-primary">
              {formatNumber(l.value)}đ
            </span>
          </div>
        ))}
        <div className="p-4 flex justify-between font-normal text-sm bg-primary-soft">
          <span className="font-medium text-text-primary">Tổng giá trị</span>
          <span className="font-medium text-text-primary tabular-nums">
            {formatNumber(detail.totalValue)}đ
          </span>
        </div>
      </div>
    </>
  );
}
