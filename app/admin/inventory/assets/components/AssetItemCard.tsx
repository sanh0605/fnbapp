import { formatNumber } from "@/lib/shared/format";
import type { AssetItemRow } from "@/lib/assets/asset-items";

export function AssetItemCard({ item }: { item: AssetItemRow }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-text-primary text-base leading-tight">
          {item.name}
        </span>
        {item.fullyDisposed && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-secondary text-text-secondary border border-border shrink-0">
            Đã thanh lý hết
          </span>
        )}
      </div>
      <div className="text-xs text-text-secondary">
        Còn {item.remainingQuantity} / mua {item.quantity} · Đã thanh lý {item.disposedQuantity}
      </div>
      <div className="font-bold text-primary text-sm">
        {formatNumber(Math.round(item.remainingValue))}đ
      </div>
    </div>
  );
}
