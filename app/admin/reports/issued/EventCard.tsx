import { formatNumber } from "@/lib/shared/format";
import { formatDate } from "@/lib/shared/datetime";
import { PhoneRow } from "@/components/ui/list/PhoneRow";

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
    <div className="py-2.5">
      <PhoneRow
        title={label}
        value={`${formatNumber(value)}đ`}
        meta={`${dateLabel} · ${itemCount} mặt hàng`}
        badge={
          <span
            className={`text-xs uppercase tracking-wider px-2 py-0.5 rounded-full ${
              kind === "STOCKTAKE" ? "bg-primary-soft text-primary" : "bg-warning/10 text-warning"
            }`}
          >
            {kind === "STOCKTAKE" ? "Kiểm kê" : "Phiếu xuất"}
          </span>
        }
      />
    </div>
  );
}
