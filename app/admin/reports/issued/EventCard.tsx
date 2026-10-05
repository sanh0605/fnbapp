import { formatNumber } from "@/lib/shared/format";
import { formatDate } from "@/lib/shared/datetime";

export function EventCard({
  kind,
  label,
  at,
  itemCount,
  value,
}: {
  kind: "STOCKTAKE" | "MANUAL";
  label: string;
  at: string;
  itemCount: number;
  value: number;
}) {
  const dateLabel = formatDate(at);
  return (
    <div className="bg-surface-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            kind === "STOCKTAKE" ? "bg-primary-soft text-primary" : "bg-warning/10 text-warning"
          }`}
        >
          {kind === "STOCKTAKE" ? "Kiểm kê" : "Phiếu xuất"}
        </span>
        <span className="text-xs text-text-secondary">{dateLabel}</span>
      </div>
      <p className="font-bold text-text-primary text-sm leading-snug">{label}</p>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Số mặt hàng</span>
        <span className="font-semibold text-text-primary">{itemCount}</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Giá trị xuất</span>
        <span className="font-bold text-danger">{formatNumber(value)}đ</span>
      </div>
    </div>
  );
}
