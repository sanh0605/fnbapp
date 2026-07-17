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
      className={`bg-surface-card rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border overflow-hidden flex flex-col transition text-left h-48 relative ${
        isOOS ? "opacity-50 grayscale cursor-not-allowed" : "hover:shadow-[0_12px_40px_rgb(0,0,0,0.08)] active:scale-95"
      }`}
    >
      {isOOS && (
        <div className="absolute inset-0 bg-surface-card/40 z-20 flex flex-col items-center justify-center">
          <span className="bg-danger text-white font-bold px-3 py-1 rounded-full shadow border-2 border-white transform -rotate-12">
            HẾT HÀNG
          </span>
        </div>
      )}
      <div className="h-28 bg-page flex items-center justify-center border-b border-border w-full shrink-0 relative">
        {promoPrice !== undefined && (
          <div className="absolute top-0 right-0 bg-danger text-white text-[10px] font-bold px-1.5 py-0.5 rounded-bl-lg z-10 shadow-sm shadow-red-500/50">
            🔥 PROMO
          </div>
        )}
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-4xl">{categoryIcon(category?.name)}</div>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col justify-between">
        <h3 className="font-bold text-text-primary text-sm leading-tight line-clamp-2">{product.name}</h3>
        <div className="mt-1">
          {promoPrice !== undefined ? (
            <div className="flex flex-col">
              <span className="text-[11px] text-text-muted line-through leading-none">
                {formatNumber(basePrice)}
              </span>
              <span className="text-warning font-bold text-sm leading-tight">
                {formatNumber(promoPrice)}
              </span>
            </div>
          ) : (
            <div className="text-warning font-bold text-sm leading-tight">
              {formatNumber(basePrice)}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
