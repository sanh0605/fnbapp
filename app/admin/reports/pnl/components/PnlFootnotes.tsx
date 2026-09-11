import type { PnlTable } from "@/lib/reports/profit-and-loss-table";

// Only notes the data calls for (spec, "Ghi chú dưới bảng"); none, nothing shown.
export function PnlFootnotes({ footnotes }: { footnotes: PnlTable["footnotes"] }) {
  if (footnotes.length === 0) return null;
  return (
    <section aria-label="Ghi chú" className="space-y-1">
      <h2 className="text-sm font-bold text-text-primary">Ghi chú</h2>
      <ul className="list-disc space-y-1 pl-5 text-xs text-text-secondary">
        {footnotes.map(f => (
          <li key={f.key}>{f.text}</li>
        ))}
      </ul>
    </section>
  );
}
