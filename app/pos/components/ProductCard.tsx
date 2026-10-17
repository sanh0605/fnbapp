"use client";

import { formatNumber } from "@/lib/shared/format";

interface ProductCardProps {
  product: any;
  sizes: { variant: any; price: number }[];
  hasPromo: boolean;
  hasOptions: boolean;
  disabled: boolean;
  onOpen: () => void;
  onQuickAdd: (variant: any) => void;
}

export function ProductCard({
  product,
  sizes,
  hasPromo,
  hasOptions,
  disabled,
  onOpen,
  onQuickAdd,
}: ProductCardProps) {
  return (
    <div className="bg-surface-card border border-border rounded-card p-3 flex flex-col justify-between gap-2">
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className="text-left w-full disabled:opacity-50"
      >
        <div className="text-[15px] font-semibold text-text-primary leading-snug line-clamp-2">
          {product.name}
        </div>
        {hasOptions && (
          <div className="text-xs text-text-secondary mt-0.5">Có tuỳ chọn</div>
        )}
        {hasPromo && (
          <span className="inline-block mt-1 bg-primary-soft text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
            Khuyến mãi
          </span>
        )}
      </button>

      <div className="flex flex-wrap gap-1.5">
        {sizes.map((size) => (
          <button
            key={size.variant.id}
            type="button"
            disabled={disabled}
            aria-label={`Thêm ${product.name} ${size.variant.size_name}`}
            onClick={(e) => {
              onQuickAdd(size.variant);
              e.currentTarget.blur();
            }}
            className="flex-1 basis-[4.5rem] min-h-[44px] bg-primary-soft rounded-button px-2 py-1 flex flex-col items-center justify-center disabled:opacity-50"
          >
            <div className="text-xs text-text-secondary leading-tight">
              {size.variant.size_name}
            </div>
            <div className="text-sm font-bold text-primary leading-tight">
              {formatNumber(size.price)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
