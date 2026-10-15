import { formatNumber } from "@/lib/shared/format";
import { formatMonthLabel } from "@/lib/shared/datetime";

export function MonthCard({
  yearMonth,
  usedValue,
  shrinkageValue,
}: {
  yearMonth: string;
  usedValue: number;
  shrinkageValue: number;
}) {
  const total = usedValue + shrinkageValue;
  const isZero = total === 0;

  return (
    <div className="bg-surface-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-bold text-text-primary text-sm">
          Tháng {formatMonthLabel(yearMonth)}
        </span>
        <span className={`font-bold ${isZero ? "text-text-muted" : "text-text-primary"}`}>
          {formatNumber(total)}đ
        </span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Hàng dùng</span>
        <span className={`tabular-nums ${usedValue === 0 ? "text-text-muted" : "text-text-primary"}`}>
          {formatNumber(usedValue)}đ
        </span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Hao hụt</span>
        <span className={`tabular-nums ${shrinkageValue === 0 ? "text-text-muted" : "text-text-primary"}`}>
          {formatNumber(shrinkageValue)}đ
        </span>
      </div>
    </div>
  );
}
