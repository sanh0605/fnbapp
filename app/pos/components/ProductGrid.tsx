"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { ProductPhoneRow } from "./ProductPhoneRow";

interface ProductGridProps {
  categories: any[];
  products?: any[];
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredProducts: any[];
  variants: any[];
  promoVariantsMap: Map<string, number>;
  productsWithOptions: Set<string>;
  selectedProductId?: string | null;
  onProductClick: (product: any) => void;
  disabled: boolean;
  children?: React.ReactNode;
}

export function ProductGrid({
  categories,
  products = [],
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  filteredProducts,
  variants,
  promoVariantsMap,
  productsWithOptions,
  selectedProductId = null,
  onProductClick,
  disabled,
  children,
}: ProductGridProps) {
  const [moreBelow, setMoreBelow] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  const updateMoreBelow = () => {
    const nav = navRef.current;
    if (!nav) return;
    setMoreBelow(nav.scrollTop + nav.clientHeight < nav.scrollHeight - 1);
  };

  useEffect(() => {
    updateMoreBelow();
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      updateMoreBelow();
    });
    observer.observe(nav);
    return () => {
      observer.disconnect();
    };
  }, [categories?.length]);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (typeof window === "undefined" || !window.matchMedia?.("(max-width: 767px)").matches) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (typeof window === "undefined" || !window.matchMedia?.("(max-width: 767px)").matches) return;
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

  const categoryButtonClass = (isActive: boolean) =>
    `snap-start shrink-0 px-4 py-2 md:px-5 md:py-2.5 lg:px-2 lg:py-2 rounded-full lg:rounded-card text-sm md:text-base lg:text-[16px] font-medium lg:font-bold whitespace-nowrap lg:whitespace-normal min-h-[44px] lg:h-[70px] lg:[@media(max-height:719px)]:h-14 flex flex-col items-center justify-center text-center gap-0.5 border transition-all duration-150 active:scale-95 transform ${
      isActive
        ? "bg-primary text-on-primary border-primary shadow-md lg:bg-primary-soft lg:text-primary lg:shadow-none"
        : "bg-surface-secondary text-text-secondary border-transparent hover:bg-border lg:bg-surface-card lg:text-text-primary lg:hover:bg-surface-secondary"
    }`;

  return (
    <div className="relative flex-1 flex flex-col lg:pl-[132px] min-h-0 overflow-hidden">
      <div className="bg-surface-card px-4 pt-3 pb-2 shrink-0 lg:border-b lg:border-border">
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

      <nav
        ref={navRef}
        onScroll={updateMoreBelow}
        aria-label="Danh mục món"
        className="bg-surface-card px-4 pb-3 shrink-0 lg:absolute lg:inset-y-0 lg:left-0 lg:w-[132px] lg:p-2 lg:border-r lg:border-border lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-2 overflow-x-auto pb-2 snap-x lg:flex-col lg:gap-1.5 lg:pb-8 lg:overflow-x-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setActiveCategory("BEST_SELLERS")}
            className={categoryButtonClass(!isSearching && activeCategory === "BEST_SELLERS")}
          >
            Bán chạy
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("ALL")}
            className={categoryButtonClass(!isSearching && activeCategory === "ALL")}
          >
            Tất cả món
          </button>
          {categories.map((c: any) => {
            const count = products.filter((p: any) => p.category_id === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                className={categoryButtonClass(!isSearching && activeCategory === c.id)}
              >
                <span>{c.icon ? `${c.icon} ${c.name}` : c.name}</span>
                <small
                  aria-hidden="true"
                  className="hidden lg:block text-[13px] font-medium text-text-secondary"
                >
                  {count} món
                </small>
              </button>
            );
          })}
        </div>
        {moreBelow && (
          <div
            aria-hidden="true"
            className="hidden lg:flex sticky -bottom-2 pointer-events-none h-14 -mt-14 bg-gradient-to-t from-surface-card via-surface-card/90 to-transparent items-end justify-center pb-1"
          >
            <ChevronDown className="w-6 h-6 text-text-secondary" />
          </div>
        )}
      </nav>

      <div
        className={`flex-1 overflow-y-auto min-h-[200px] p-4 pb-28 md:pb-4 ${
          children ? "md:min-h-[110px]" : ""
        }`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
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
          <>
            <div className="md:hidden flex flex-col -mx-4 -my-4 bg-surface-card">
              {filteredProducts.map((p: any) => {
                const prodVariants = variants.filter((v: any) => v.product_id === p.id);
                const sizes = prodVariants
                  .map((variant: any) => ({
                    variant,
                    price: Number(variant.price),
                  }))
                  .sort((a: any, b: any) => a.price - b.price);
                const hasPromo = prodVariants.some((v: any) => promoVariantsMap.has(v.id));

                return (
                  <ProductPhoneRow
                    key={p.id}
                    product={p}
                    sizes={sizes}
                    hasPromo={hasPromo}
                    disabled={disabled}
                    onOpen={() => onProductClick(p)}
                  />
                );
              })}
            </div>

            <div className="hidden md:grid grid-cols-3 gap-2.5 content-start">
              {filteredProducts.map((p: any) => {
                const prodVariants = variants.filter((v: any) => v.product_id === p.id);
                const sizes = prodVariants
                  .map((variant: any) => ({
                    variant,
                    price: Number(variant.price),
                  }))
                  .sort((a: any, b: any) => a.price - b.price);
                const hasPromo = prodVariants.some((v: any) => promoVariantsMap.has(v.id));

                return (
                  <ProductCard
                    key={p.id}
                    product={p}
                    sizes={sizes}
                    hasPromo={hasPromo}
                    hasOptions={productsWithOptions.has(p.id)}
                    isSelected={selectedProductId === p.id}
                    disabled={disabled}
                    onOpen={() => onProductClick(p)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {children}
    </div>
  );
}
