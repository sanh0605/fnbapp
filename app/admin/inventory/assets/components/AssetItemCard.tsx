import { formatNumber } from "@/lib/shared/format";
import { Badge } from "@/components/ui/Badge";
import type { AssetItemRow } from "@/lib/assets/asset-items";

export function AssetItemCard({ item }: { item: AssetItemRow }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-text-primary text-base leading-tight">
          {item.name}
        </span>
        {item.fullyDisposed && (
          <Badge variant="neutral">
            Đã thanh lý hết
          </Badge>
        )}
      </div>
      <div className="text-xs text-text-secondary">
        Còn {item.remainingQuantity} / mua {item.quantity} · Đã thanh lý {item.disposedQuantity}
      </div>
      <div className="text-text-primary text-sm tabular-nums">
        {formatNumber(Math.round(item.remainingValue))}đ
      </div>
    </div>
  );
}
