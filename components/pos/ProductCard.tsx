"use client";

import { categoryIcon } from "@/lib/pos-category-icons";
import { formatNumber } from "@/lib/format";

interface ProductCardProps {
  product: any;
  category: any;
  basePrice: number;
  isOOS: boolean;
  promoPrice?: number;
  onClick: () => void;
}

export function ProductCard({
  product,
  category,
  basePrice,
  isOOS,
  promoPrice,
  onClick,
}: ProductCardProps) {
  return (
    <button
      onClick={() => !isOOS && onClick()}
      disabled={isOOS}
      className={`bg-surface-card rounded-2xl border border-border shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col transition-all duration-200 text-left relative w-full h-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
        isOOS 
          ? "opacity-50 grayscale cursor-not-allowed" 
          : "hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:scale-[1.02] active:scale-[0.98] will-change-transform"
      }`}
    >
      {isOOS && (
        <div className="absolute inset-0 bg-surface-card/40 z-20 flex flex-col items-center justify-center">
          <span className="bg-danger text-white text-xs md:text-sm font-bold px-3 py-1.5 rounded-full shadow border-2 border-white transform -rotate-12">
            HẾT HÀNG
          </span>
        </div>
      )}
      <div className="aspect-square w-full bg-surface-secondary flex items-center justify-center border-b border-border shrink-0 relative overflow-hidden">
        {promoPrice !== undefined && (
          <div className="absolute top-2 right-2 bg-danger text-white text-[10px] font-bold px-2 py-0.5 rounded-full z-10 shadow-sm">
            PROMO
          </div>
        )}
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-4xl text-text-secondary">{categoryIcon(category?.name)}</div>
        )}
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
    </button>
  );
}
