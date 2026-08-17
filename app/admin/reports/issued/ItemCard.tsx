import { formatNumber } from "@/lib/format";

// Extracted from page.tsx (not left inline) so it can be unit-rendered
// directly (OPEN-ITEMS 38/41) -- Next.js's route-module type constraint
// only allows a fixed set of named exports from a page.tsx file, so an
// exported helper component has to live in its own module.
export function ItemCard({
  name,
  unitName,
  issuedQuantity,
  issuedValue,
  closingValue,
}: {
  name: string;
  unitName: string;
  issuedQuantity: number;
  issuedValue: number;
  closingValue: number;
}) {
  return (
    <div className="bg-surface-card border border-border rounded-xl p-4 flex flex-col gap-2">
      <p className="font-bold text-text-primary text-sm leading-snug">{name}</p>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Đã xuất</span>
        <span className="font-semibold text-text-primary">
          {formatNumber(issuedQuantity, { withDecimals: true })} {unitName}
        </span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Giá trị đã xuất</span>
        <span className="font-bold text-danger">{formatNumber(issuedValue)}đ</span>
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-text-secondary">Giá trị tồn còn lại</span>
        <span className="font-semibold text-text-primary">{formatNumber(closingValue)}đ</span>
      </div>
    </div>
  );
}
