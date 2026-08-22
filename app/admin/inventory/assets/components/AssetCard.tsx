import { formatNumber } from "@/lib/format";
import { DisposeAssetForm } from "./DisposeAssetForm";
import type { AssetView } from "../actions";

const BUCKET_LABEL: Record<AssetView["bucket"], string> = {
  IN_USE: "Còn dùng",
  FULLY_DEPRECIATED: "Đã hết khấu hao",
  DISPOSED: "Đã thanh lý",
};

const BUCKET_CLASS: Record<AssetView["bucket"], string> = {
  IN_USE: "bg-primary-soft text-primary",
  FULLY_DEPRECIATED: "bg-warning/10 text-warning",
  DISPOSED: "bg-surface-secondary text-text-secondary",
};

// Section 5.1: "one card per asset: name, quantity held, acquired date,
// cost, term, months elapsed, remaining value. No horizontal table."
// Extracted from page.tsx so it renders on its own (OPEN-ITEMS 38).
export function AssetCard({ asset }: { asset: AssetView }) {
  const acquiredLabel = new Date(asset.acquiredDate).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="bg-surface-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${BUCKET_CLASS[asset.bucket]}`}>
          {BUCKET_LABEL[asset.bucket]}
        </span>
        <span className="text-xs text-text-secondary">Mua ngày {acquiredLabel}</span>
      </div>
      <p className="font-bold text-text-primary text-sm leading-snug">{asset.name}</p>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Số lượng còn</span>
        <span className="font-semibold text-text-primary">{asset.remainingQuantity} / {asset.quantity} cái</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Đơn giá</span>
        <span className="font-semibold text-text-primary">{formatNumber(asset.unitCost)}đ</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Thời hạn khấu hao</span>
        <span className="font-semibold text-text-primary">{asset.termMonths} tháng</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Giá trị còn lại</span>
        <span className="font-bold text-primary">{formatNumber(asset.remainingValue)}đ</span>
      </div>
      {asset.bucket !== "DISPOSED" && (
        <div className="flex justify-end pt-2 mt-1 border-t border-border">
          <DisposeAssetForm asset={asset} />
        </div>
      )}
    </div>
  );
}
