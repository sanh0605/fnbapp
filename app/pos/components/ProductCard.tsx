"use client";

import { formatNumber } from "@/lib/shared/format";

interface ProductCardProps {
  product: any;
  category: any;
  basePrice: number;
  promoPrice?: number;
  onClick: () => void;
}

export function ProductCard({
  product,
  category,
  basePrice,
  promoPrice,
  onClick,
}: ProductCardProps) {
  const hasImage = Boolean(product.image_url);
  const hasIcon = Boolean(category?.icon);

  return (
    <button
      onClick={onClick}
      className={`bg-surface-card rounded-2xl border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col transition-all duration-200 text-left relative w-full h-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:scale-[1.02] active:scale-[0.98] will-change-transform ${
        !hasImage ? "p-3 md:p-4 min-h-[88px] md:min-h-[100px] justify-between" : ""
      }`}
    >
      {hasImage ? (
        <>
          <div className="aspect-square w-full bg-surface-secondary flex items-center justify-center border-b border-border shrink-0 relative overflow-hidden">
            {promoPrice !== undefined && (
              <div className="absolute top-2 right-2 bg-danger text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm">
                KM
              </div>
            )}
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="p-3 md:p-4 flex-1 flex flex-col justify-between w-full">
            <h3 className="font-semibold text-text-primary text-sm leading-tight line-clamp-2 md:text-base">{product.name}</h3>
            <div className="mt-2">
              {promoPrice !== undefined ? (
                <div className="flex flex-col">
                  <span className="text-[11px] text-text-muted line-through leading-none mb-0.5">
                    {formatNumber(basePrice)}
                  </span>
                  <span className="text-danger font-bold text-sm leading-tight md:text-base">
                    {formatNumber(promoPrice)}
                  </span>
                </div>
              ) : (
                <div className="text-text-primary font-bold text-sm leading-tight md:text-base">
                  {formatNumber(basePrice)}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="w-full">
            <div className="flex items-start justify-between gap-1 mb-1">
              {hasIcon && <span className="text-xl shrink-0 leading-none">{category.icon}</span>}
              {promoPrice !== undefined && (
                <span className="ml-auto bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 shadow-sm">
                  KM
                </span>
              )}
            </div>
            <h3 className="font-semibold text-text-primary text-sm leading-tight line-clamp-2 md:text-base">{product.name}</h3>
          </div>
          <div className="mt-2 w-full">
            {promoPrice !== undefined ? (
              <div className="flex flex-col">
                <span className="text-[11px] text-text-muted line-through leading-none mb-0.5">
                  {formatNumber(basePrice)}
                </span>
                <span className="text-danger font-bold text-sm leading-tight md:text-base">
                  {formatNumber(promoPrice)}
                </span>
              </div>
            ) : (
              <div className="text-text-primary font-bold text-sm leading-tight md:text-base">
                {formatNumber(basePrice)}
              </div>
            )}
          </div>
        </>
      )}
    </button>
  );
}
