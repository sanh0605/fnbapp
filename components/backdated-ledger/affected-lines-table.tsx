import React from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import type { AffectedOrderLine } from "@/lib/backdated-ledger/find-affected-lines";
import type { BackdatedEventRecoveryChange } from "@/lib/backdated-ledger/recompute-event";

interface AffectedLinesTableProps {
  lines: AffectedOrderLine[];
  changes: BackdatedEventRecoveryChange[];
}

export function AffectedLinesTable({ lines, changes }: AffectedLinesTableProps) {
  if (!lines || lines.length === 0) {
    return (
      <div className="text-sm text-text-secondary py-4 italic">
        Không có order line nào bị ảnh hưởng — giao dịch này có thể là nhập kho cho item chưa được bán trong cửa sổ thời gian.
      </div>
    );
  }

  const changeByLineId = new Map(changes.map(c => [c.line_id, c]));

  let totalDelta = 0;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-page">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Order #</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Sale time (Vietnam)</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Product ID</th>
            <th className="px-4 py-3 text-right font-medium text-text-secondary">Qty</th>
            <th className="px-4 py-3 text-right font-medium text-text-secondary">Stored COGS</th>
            <th className="px-4 py-3 text-right font-medium text-text-secondary">New COGS</th>
            <th className="px-4 py-3 text-right font-medium text-text-secondary">Delta VND</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface-card">
          {lines.map((line) => {
            const change = changeByLineId.get(line.line_id);
            const oldCogs = line.stored_cost_at_sale;
            const newCogs = change ? change.new_cost_at_sale : oldCogs;
            const delta = newCogs - oldCogs;
            totalDelta += delta;

            const deltaColor = delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-600" : "text-text-secondary";
            const deltaSign = delta > 0 ? "+" : "";

            return (
              <tr key={line.line_id} className="hover:bg-page">
                <td className="px-4 py-3 text-primary hover:underline">
                  <Link href={`/admin/orders/${line.order_id}`}>
                    {line.order_no}
                  </Link>
                </td>
                <td className="px-4 py-3">{formatDateTime(line.sale_time)}</td>
                <td className="px-4 py-3">{line.product_id}</td>
                <td className="px-4 py-3 text-right">{formatNumber(line.qty)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(oldCogs)}</td>
                <td className="px-4 py-3 text-right">{formatNumber(newCogs)}</td>
                <td className={`px-4 py-3 text-right font-medium ${deltaColor}`}>
                  {delta !== 0 ? `${deltaSign}${formatNumber(delta)}` : "0"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-page font-medium">
          <tr>
            <td colSpan={6} className="px-4 py-3 text-right">Tổng chênh lệch:</td>
            <td className={`px-4 py-3 text-right ${totalDelta > 0 ? "text-emerald-600" : totalDelta < 0 ? "text-rose-600" : "text-text-primary"}`}>
              {totalDelta > 0 ? "+" : ""}{formatNumber(totalDelta)} VND
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
