import type { ReactNode } from "react";
import type { PnlFootnote } from "@/lib/reports/profit-and-loss-table";
import { NoteMarks } from "./pnl-display";

// Every `strong` substring (0 or 1 per footnote, lib/reports/profit-and-loss-table.ts)
// shown bold ochre, as in the sample.
function withStrong(text: string, strong: string[]): ReactNode {
  let remaining = text;
  const parts: ReactNode[] = [];
  for (const s of strong) {
    const idx = remaining.indexOf(s);
    if (idx === -1) continue;
    parts.push(remaining.slice(0, idx));
    parts.push(
      <span key={`${s}-${parts.length}`} className="font-bold text-primary">
        {s}
      </span>,
    );
    remaining = remaining.slice(idx + s.length);
  }
  parts.push(remaining);
  return parts;
}

// Rendered once inside PnlTableView (computer) and once inside
// PnlMonthCards (phone); each copy is hidden by its parent's md: classes.
export function PnlNotes({ footnotes }: { footnotes: PnlFootnote[] }) {
  if (footnotes.length === 0) return null;
  return (
    <section aria-label="Ghi chú" className="space-y-1.5 border-t border-border px-4 py-3 md:px-[18px]">
      {footnotes.map(f => (
        <p key={f.key} className="text-[13px] text-text-secondary">
          <NoteMarks numbers={[f.number]} />
          {withStrong(f.text, f.strong)}
        </p>
      ))}
    </section>
  );
}
