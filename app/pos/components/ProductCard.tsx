"use client";

import { formatNumber } from "@/lib/shared/format";

export function renderPriceRange(sizes: { variant?: any; price?: number }[]) {
  const listPrices = sizes
    .map((s) => Number(s.variant?.price ?? s.price))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);
  if (listPrices.length === 0) return null;
  const minPrice = listPrices[0];
  const maxPrice = listPrices[listPrices.length - 1];
  return (
    <>
      <span className="whitespace-nowrap">{formatNumber(minPrice)}</span>
      {maxPrice !== minPrice && (
        <small className="text-[15px] font-medium text-text-secondary">
          {" "}– <span className="whitespace-nowrap">{formatNumber(maxPrice)}</span>
        </small>
      )}
    </>
  );
}

interface ProductCardProps {
  product: any;
  sizes: { variant: any; price: number }[];
  hasPromo: boolean;
  hasOptions: boolean;
  isSelected?: boolean;
  disabled: boolean;
  onOpen: () => void;
}

export function ProductCard({
  product,
  sizes,
  hasPromo,
  hasOptions,
  isSelected = false,
  disabled,
  onOpen,
}: ProductCardProps) {

  return (
    <button
      type="button"
      aria-label={product.name}
      onClick={onOpen}
      disabled={disabled}
      className={`w-full min-h-[90px] rounded-card px-3.5 py-3 flex flex-col justify-between text-left transition-colors disabled:opacity-50 ${
        isSelected
          ? "border-2 border-primary bg-primary-soft"
          : "border border-border bg-surface-card hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-1.5 min-w-0">
        <div className="text-[18px] font-bold text-text-primary leading-tight line-clamp-2">
          {product.name}
        </div>
        {hasPromo && (
          <span className="shrink-0 bg-primary-soft text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
            Khuyến mãi
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 pt-1">
        {sizes.length > 0 ? (
          <span className="text-[17px] font-extrabold text-primary leading-none shrink-0 max-w-full">
            {renderPriceRange(sizes)}
          </span>
        ) : (
          <span />
        )}
        {hasOptions && (
          <span className="text-xs text-text-secondary shrink-0">Có tuỳ chọn</span>
        )}
      </div>
    </button>
  );
}
