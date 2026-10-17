"use client";

import { renderPriceRange } from "./ProductCard";

interface ProductPhoneRowProps {
  product: any;
  sizes: { variant: any; price: number }[];
  hasPromo: boolean;
  disabled: boolean;
  onOpen: () => void;
}

export function ProductPhoneRow({
  product,
  sizes,
  hasPromo,
  disabled,
  onOpen,
}: ProductPhoneRowProps) {
  return (
    <button
      type="button"
      aria-label={product.name}
      onClick={onOpen}
      disabled={disabled}
      className="w-full min-h-[64px] px-3.5 py-2 flex items-center justify-between gap-3 border-b border-border text-left transition-colors disabled:opacity-50 bg-surface-card active:bg-page"
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

      {sizes.length > 0 && (
        <span className="text-[17px] font-bold text-primary shrink-0">
          {renderPriceRange(sizes)}
        </span>
      )}
    </button>
  );
}
