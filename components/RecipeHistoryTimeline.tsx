"use client";

import { useMemo } from "react";
import { formatDateTime } from "@/lib/datetime";

interface Recipe {
  id: string;
  created_at: string;
  end_date?: string | null;
  ingredients_json?: string;
  ingredients?: Array<{
    ingredient_id: string;
    quantity: number | string;
    name?: string;
    unit?: string;
    unitName?: string;
  }>;
}

interface PriceHistoryEntry {
  id?: string;
  effective_at: string;
  old_price: string | number | null;
  new_price: string | number;
}

interface RecipeHistoryTimelineProps {
  recipes: Recipe[];
  priceHistory: PriceHistoryEntry[];
  variantId?: string;
}

interface TimelineEvent {
  id: string;
  type: "recipe" | "price";
  date: string;
  data: any;
}

export default function RecipeHistoryTimeline({ recipes, priceHistory }: RecipeHistoryTimelineProps) {
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = [];

    recipes.forEach((r) => {
      events.push({
        id: `recipe-${r.id}`,
        type: "recipe",
        date: r.created_at || "",
        data: r,
      });
    });

    priceHistory.forEach((p, idx) => {
      events.push({
        id: `price-${p.id || idx}`,
        type: "price",
        date: p.effective_at || "",
        data: p,
      });
    });

    // Sort descending (newest events first)
    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return events;
  }, [recipes, priceHistory]);

  const parseIngredients = (recipe: Recipe) => {
    // If ingredients are already resolved and passed
    if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
      return recipe.ingredients;
    }
    
    // Otherwise parse ingredients_json
    if (recipe.ingredients_json) {
      try {
        return JSON.parse(recipe.ingredients_json);
      } catch (e) {
        console.error("Loi parse ingredients_json:", e);
      }
    }
    return [];
  };

  const formatPrice = (p: string | number | null) => {
    if (p === null || p === undefined) return "---";
    const num = typeof p === "string" ? Number(p) : p;
    return num.toLocaleString("vi-VN") + " đ";
  };

  return (
    <div className="relative pl-6 md:pl-8">
      {/* Vertical Line */}
      <div className="absolute top-2 bottom-2 left-[27px] md:left-[35px] w-0.5 bg-gray-200" />

      <div className="space-y-6">
        {timelineEvents.length === 0 ? (
          <div className="text-center py-8 text-gray-500 italic text-sm bg-white rounded-xl border border-gray-100 p-4">
            Chưa có lịch sử thay đổi nào.
          </div>
        ) : (
          timelineEvents.map((evt) => {
            const isRecipe = evt.type === "recipe";

            if (isRecipe) {
              const r = evt.data as Recipe;
              const isActive = !r.end_date || r.end_date === "";
              const ingredients = parseIngredients(r);

              return (
                <div key={evt.id} className="relative group">
                  {/* Circle Dot */}
                  <div
                    className={`absolute -left-[27px] md:-left-[35px] top-3.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-blue-500 ring-4 ring-blue-50 transition-transform group-hover:scale-110 z-10`}
                  />

                  {/* Card content */}
                  <div className={`bg-white rounded-xl border p-4 shadow-sm transition-colors transition-shadow duration-200 ${
                    isActive ? "border-emerald-200 ring-2 ring-emerald-50/50" : "border-gray-100 hover:border-gray-200"
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          Công thức
                        </span>
                        <span className="text-[11px] font-mono text-gray-400">ID: {r.id}</span>
                      </div>
                      
                      {isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse">
                          Đang áp dụng
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-gray-500 space-y-1.5 mb-3">
                      <div className="flex items-center gap-1.5">
                        <span>Bắt đầu:</span>
                        <span className="font-semibold text-gray-700">{formatDateTime(r.created_at)}</span>
                      </div>
                      {r.end_date && (
                        <div className="flex items-center gap-1.5">
                          <span>Kết thúc:</span>
                          <span className="font-semibold text-gray-700">{formatDateTime(r.end_date)}</span>
                        </div>
                      )}
                    </div>

                    {/* Ingredients List */}
                    <div className="bg-gray-50 rounded-lg border border-gray-100/80 p-3">
                      <div className="text-[10px] uppercase font-bold text-gray-400 mb-2 tracking-wider">Định mức thành phần</div>
                      {ingredients.length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Chưa khai báo thành phần</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {ingredients.map((ing: any, iIdx: number) => {
                            const name = ing.name || ing.ingredient_id;
                            const unit = ing.unit || ing.unitName || "";
                            return (
                              <li key={iIdx} className="text-xs flex justify-between border-b border-gray-200/50 pb-1.5 last:border-0 last:pb-0">
                                <span className="font-medium text-gray-700">{name}</span>
                                <span className="font-bold text-blue-600">{ing.quantity} {unit}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              );
            } else {
              const p = evt.data as PriceHistoryEntry;
              const hasOldPrice = p.old_price !== null && p.old_price !== undefined && Number(p.old_price) > 0;

              return (
                <div key={evt.id} className="relative group">
                  {/* Circle Dot */}
                  <div
                    className={`absolute -left-[27px] md:-left-[35px] top-3.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-amber-500 ring-4 ring-amber-50 transition-transform group-hover:scale-110 z-10`}
                  />

                  {/* Card content */}
                  <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:border-gray-200 transition-colors duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                        Thay đổi giá
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                      <span>Hiệu lực từ:</span>
                      <span className="font-semibold text-gray-700">{formatDateTime(p.effective_at)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      {hasOldPrice ? (
                        <>
                          <span className="text-gray-400 line-through font-medium">{formatPrice(p.old_price)}</span>
                          <span className="text-gray-400">➔</span>
                          <span className="font-extrabold text-amber-600 text-base">{formatPrice(p.new_price)}</span>
                        </>
                      ) : (
                        <span className="font-extrabold text-amber-600 text-base">Giá bán đầu: {formatPrice(p.new_price)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            }
          })
        )}
      </div>
    </div>
  );
}
