import { formatNumber } from "@/lib/shared/format";
import type { PnlCellSource } from "@/lib/reports/profit-and-loss-table";

// What makes up one cell. Shared by the computer table and the phone cards.
// `negate` mirrors the cell's own row (isCostRow, pnl-display.tsx): a cost
// cell's rows show with a minus, and that minus is not red ("Dấu của chi
// phí" -- red stays for a result below zero, not for a cost).
export function PnlSourceList({ sources, negate = false }: { sources: PnlCellSource[]; negate?: boolean }) {
  return (
    <ul className="divide-y divide-border">
      {sources.map((s, i) => {
        const meta = [s.date, s.ref ? `Đơn nhập ${s.ref}` : null].filter(Boolean).join(" · ");
        const shown = negate ? (s.amount === 0 ? 0 : -s.amount) : s.amount;
        const tone = !negate && shown < 0 ? "text-danger" : "text-text-primary";
        return (
          <li key={`${s.kind}-${s.id ?? "pos"}-${i}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="break-words text-text-primary">{s.label}</p>
              {meta && <p className="text-xs text-text-secondary">{meta}</p>}
            </div>
            <span className={`shrink-0 tabular-nums ${tone}`}>{formatNumber(shown)}</span>
          </li>
        );
      })}
    </ul>
  );
}
