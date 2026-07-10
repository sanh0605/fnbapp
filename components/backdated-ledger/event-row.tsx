import React from "react";
import Link from "next/link";
import { formatDateTime } from "@/lib/datetime";
import { formatNumber } from "@/lib/format";
import { StatusBadge } from "./status-badge";

export function EventRow({ event }: { event: any }) {
  const effectiveTime = new Date(event.effective_timestamp).getTime();
  const visibilityTime = new Date(event.visibility_timestamp).getTime();
  const lagMs = visibilityTime - effectiveTime;
  const lagDays = Math.floor(lagMs / (1000 * 60 * 60 * 24));
  const lagHours = Math.floor((lagMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const lagText = lagDays > 0 ? `${lagDays}d ${lagHours}h` : `${lagHours}h`;

  return (
    <tr className="hover:bg-gray-50 group">
      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
        {formatDateTime(event.detected_at)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900">
        {event.source_table} <span className="text-gray-400 mx-1">/</span> {event.source_id}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900">
        {event.item_reference}
      </td>
      <td className={`px-4 py-3 text-sm text-right font-medium ${event.quantity_change > 0 ? 'text-emerald-600' : event.quantity_change < 0 ? 'text-rose-600' : ''}`}>
        {event.quantity_change > 0 ? '+' : ''}{event.quantity_change}
      </td>
      <td className="px-4 py-3 text-sm text-right text-gray-900">
        {formatNumber(event.unit_cost)}
      </td>
      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
        {lagText}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm">
        <StatusBadge status={event.status} />
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
        <Link 
          href={`/admin/audit/backdated-ledger/${event.id}`}
          className="text-blue-600 hover:text-blue-900 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Chi tiết →
        </Link>
      </td>
    </tr>
  );
}
