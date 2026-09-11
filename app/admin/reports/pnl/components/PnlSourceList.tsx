import { formatNumber } from "@/lib/shared/format";
import type { PnlCellSource } from "@/lib/reports/profit-and-loss-table";

// What makes up one cell. Shared by the computer table and the phone cards.
export function PnlSourceList({ sources }: { sources: PnlCellSource[] }) {
  return (
    <ul className="divide-y divide-border">
      {sources.map((s, i) => {
        const meta = [s.date, s.ref ? `Đơn nhập ${s.ref}` : null].filter(Boolean).join(" · ");
        return (
          <li key={`${s.kind}-${s.id ?? "pos"}-${i}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="break-words text-text-primary">{s.label}</p>
              {meta && <p className="text-xs text-text-secondary">{meta}</p>}
            </div>
            <span className={`shrink-0 tabular-nums ${s.amount < 0 ? "text-danger" : "text-text-primary"}`}>
              {formatNumber(s.amount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
