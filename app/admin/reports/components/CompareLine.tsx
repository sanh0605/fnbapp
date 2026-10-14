import { formatDecimal } from "@/lib/shared/format";

const ONE_DECIMAL = { minDigits: 1, maxDigits: 1 };

// BR-UI-007: one line under a card per compare period; the arrow follows the
// value rounded to one decimal, so a change that rounds to 0.0 reads as none.
export function CompareLine({ change, label }: { change: number | null; label: string }) {
  if (change === null) {
    return (
      <div className="text-xs text-text-muted">
        {`Kỳ trước chưa có số · ${label}`}
      </div>
    );
  }

  let r = Math.round(change * 10) / 10;
  if (Object.is(r, -0) || r === 0) {
    r = 0;
  }

  if (r > 0) {
    return (
      <div className="text-xs text-success">
        {`▲ ${formatDecimal(r, ONE_DECIMAL)}% ${label}`}
      </div>
    );
  }

  if (r < 0) {
    return (
      <div className="text-xs text-danger">
        {`▼ ${formatDecimal(Math.abs(r), ONE_DECIMAL)}% ${label}`}
      </div>
    );
  }

  return (
    <div className="text-xs text-text-muted">
      {`− ${formatDecimal(0, ONE_DECIMAL)}% ${label}`}
    </div>
  );
}
