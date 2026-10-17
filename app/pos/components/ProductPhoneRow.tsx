"use client";

import { formatNumber } from "@/lib/shared/format";

interface ProductPhoneRowProps {
  product: any;
  sizes: { variant: any; price: number }[];
  hasPromo: boolean;
  isSelected?: boolean;
  disabled: boolean;
  onOpen: () => void;
}

export function ProductPhoneRow({
  product,
  sizes,
  hasPromo,
  isSelected = false,
  disabled,
  onOpen,
}: ProductPhoneRowProps) {
  const listPrices = sizes
    .map((s) => Number(s.variant?.price ?? s.price))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);
  const minPrice = listPrices[0];
  const maxPrice = listPrices[listPrices.length - 1];

  return (
    <button
      type="button"
      aria-label={product.name}
      onClick={onOpen}
      disabled={disabled}
      className={`w-full min-h-[64px] px-3.5 py-2 flex items-center justify-between gap-3 border-b border-border text-left transition-colors disabled:opacity-50 ${
        isSelected ? "bg-primary-soft" : "bg-surface-card active:bg-page"
      }`}
    >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-[18px] font-semibold text-text-primary leading-snug truncate">
          {product.name}
        </span>
        {hasPromo && (
          <span className="shrink-0 bg-primary-soft text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
            Khuyến mãi
          </span>
        )}
      </div>

      {listPrices.length > 0 && (
        <span className="text-[17px] font-bold text-primary shrink-0">
          {formatNumber(minPrice)}
          {maxPrice !== minPrice && (
            <small className="text-[15px] font-medium text-text-secondary">
              {" "}– {formatNumber(maxPrice)}
            </small>
          )}
        </span>
      )}
    </button>
  );
}
