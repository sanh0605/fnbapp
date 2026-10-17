"use client";
 
import { useRef } from "react";
import { ProductCard } from "./ProductCard";
import { Search } from "lucide-react";
 
interface ProductGridProps {
  categories: any[];
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredProducts: any[];
  variants: any[];
  promoVariantsMap: Map<string, number>;
  productsWithOptions: Set<string>;
  onProductClick: (product: any) => void;
  onQuickAdd: (product: any, variant: any) => void;
  disabled: boolean;
}
 
export function ProductGrid({
  categories,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  filteredProducts,
  variants,
  promoVariantsMap,
  productsWithOptions,
  onProductClick,
  onQuickAdd,
  disabled,
}: ProductGridProps) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
 
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
 
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const diffX = e.changedTouches[0].clientX - touchStartX.current;
    const diffY = e.changedTouches[0].clientY - touchStartY.current;
 
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
      const tabList = ["BEST_SELLERS", "ALL", ...categories.map((c) => c.id)];
      const currentIndex = tabList.indexOf(activeCategory);
      if (currentIndex !== -1) {
        if (diffX < 0) {
          const nextIndex = Math.min(tabList.length - 1, currentIndex + 1);
          if (nextIndex !== currentIndex) {
            setActiveCategory(tabList[nextIndex]);
          }
        } else {
          const prevIndex = Math.max(0, currentIndex - 1);
          if (prevIndex !== currentIndex) {
            setActiveCategory(tabList[prevIndex]);
          }
        }
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };
 
  const isSearching = Boolean(searchQuery.trim());

  return (
    <>
      <div className="bg-surface-card px-4 pt-4 pb-2 shrink-0">
        <div className="relative w-full">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            <Search className="w-5 h-5" />
          </span>
          <input
            aria-label="Tìm kiếm sản phẩm"
            type="text"
            placeholder="Ví dụ: Trà đào"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface-secondary border border-border rounded-2xl pl-12 pr-12 py-3 text-base text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-focus-ring focus:border-transparent min-h-[48px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center text-text-muted hover:text-text-primary active:scale-95 transition-all animate-fade-in-quick"
              aria-label="Xoá tìm kiếm"
            >
              <span className="w-6 h-6 rounded-full bg-surface-card border border-border flex items-center justify-center text-xs shadow-sm hover:bg-surface-secondary">
                ✕
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-surface-card px-4 pb-3 shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveCategory("BEST_SELLERS")}
            className={`snap-start shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-sm md:text-base font-medium whitespace-nowrap min-h-[44px] flex items-center transition-all duration-150 active:scale-95 transform ${
              !isSearching && activeCategory === "BEST_SELLERS"
                ? "bg-primary text-on-primary shadow-md"
                : "bg-surface-secondary text-text-secondary hover:bg-border"
            }`}
          >
            Bán chạy
          </button>
          <button
            onClick={() => setActiveCategory("ALL")}
            className={`snap-start shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-sm md:text-base font-medium whitespace-nowrap min-h-[44px] flex items-center transition-all duration-150 active:scale-95 transform ${
              !isSearching && activeCategory === "ALL"
                ? "bg-primary text-on-primary shadow-md"
                : "bg-surface-secondary text-text-secondary hover:bg-border"
            }`}
          >
            Tất cả món
          </button>
          {categories.map((c: any) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`snap-start shrink-0 px-4 py-2 md:px-5 md:py-2.5 rounded-full text-sm md:text-base font-medium whitespace-nowrap min-h-[44px] flex items-center transition-all duration-150 active:scale-95 transform ${
                !isSearching && activeCategory === c.id
                  ? "bg-primary text-on-primary shadow-md"
                  : "bg-surface-secondary text-text-secondary hover:bg-border"
              }`}
            >
              {c.icon ? `${c.icon} ${c.name}` : c.name}
            </button>
          ))}
        </div>
      </div>
 
      <div className="flex-1 overflow-y-auto p-4 pb-28 md:pb-6" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {filteredProducts.length === 0 ? (
          activeCategory === "BEST_SELLERS" && !searchQuery.trim() ? (
            <div className="h-full flex flex-col items-center justify-center text-text-muted py-16 animate-fade-in-quick">
              <svg className="w-16 h-16 mb-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold">Chưa có món bán chạy ở điểm bán này</p>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-text-muted py-16 animate-fade-in-quick">
              <svg className="w-16 h-16 mb-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold">Không tìm thấy sản phẩm nào</p>
              <p className="text-xs text-text-muted mt-1">Thử tìm kiếm với từ khóa khác</p>
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3">
            {filteredProducts.map((p: any) => {
              const prodVariants = variants.filter((v: any) => v.product_id === p.id);
              const sizes = prodVariants
                .map((variant: any) => ({
                  variant,
                  price: promoVariantsMap.get(variant.id) ?? Number(variant.price),
                }))
                .sort((a: any, b: any) => a.price - b.price);
              const hasPromo = prodVariants.some((v: any) => promoVariantsMap.has(v.id));
              const hasOptions = productsWithOptions.has(p.id);
 
              return (
                <ProductCard
                  key={p.id}
                  product={p}
                  sizes={sizes}
                  hasPromo={hasPromo}
                  hasOptions={hasOptions}
                  disabled={disabled}
                  onOpen={() => onProductClick(p)}
                  onQuickAdd={(variant) => onQuickAdd(p, variant)}
                />
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
