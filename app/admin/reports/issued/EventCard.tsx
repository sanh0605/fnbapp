import { formatNumber } from "@/lib/shared/format";
import { formatDateTimeFull } from "@/lib/shared/datetime";
import { PhoneRow } from "@/components/ui/list/PhoneRow";
import { Badge } from "@/components/ui/Badge";

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
  const dateLabel = formatDateTimeFull(at);
  return (
    <div className="py-2.5">
      <PhoneRow
        title={label}
        value={`${formatNumber(value)}đ`}
        meta={`${dateLabel} · ${itemCount} mặt hàng`}
        badge={
          <Badge variant={kind === "STOCKTAKE" ? "processing" : "neutral"}>
            {kind === "STOCKTAKE" ? "Kiểm kê" : "Phiếu xuất"}
          </Badge>
        }
      />
    </div>
  );
}
