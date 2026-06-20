import { findAll } from "@/lib/sheets_db";
import ProductForm from "@/components/ProductForm";
import HistoryModal from "@/components/HistoryModal";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [categories, products, variants, recipes, baseIngredients, semiProducts, allUnits, allPriceHistory] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Recipes"),
    findAll("Base_Ingredients"),
    findAll("Semi_Products"),
    findAll("Units"),
    findAll("Product_Price_History")
  ]);

  const activeCategories = categories.filter(c => c.status !== "DELETED");
  const activeProducts = products.filter(p => p.status !== "DELETED");
  const activeVariants = variants.filter(v => v.status !== "DELETED");
  
  const activeBaseIngredients = baseIngredients.filter(b => b.status !== "DELETED");
  const activeSemiProducts = semiProducts.filter(s => s.status !== "DELETED");
  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  // Build the rich data for the form
  const enhancedProducts = activeProducts.map(p => {
    const productVariants = activeVariants.filter(v => v.product_id === p.id);
    const variantsWithRecipes = productVariants.map(v => {
      const recipe = recipes.find(r => r.target_type === "PRODUCT_VARIANT" && r.target_id === v.id);
      let ingredients = [];
      if (recipe && recipe.ingredients_json) {
        try { ingredients = JSON.parse(recipe.ingredients_json); } catch(e){}
      }
      return { ...v, ingredients };
    });
    
    // Thu thập toàn bộ lịch sử giá của các variants thuộc Product này
    const pPriceHistory = allPriceHistory
      .filter((ph:any) => productVariants.some(v => v.id === ph.variant_id))
      .sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Thu thập toàn bộ lịch sử công thức của các variants thuộc Product này
    const pRecipeHistory = recipes
      .filter((r:any) => r.target_type === "PRODUCT_VARIANT" && productVariants.some(v => v.id === r.target_id))
      .map((r:any) => {
        let ings = [];
        if (r.ingredients_json) {
          try { ings = JSON.parse(r.ingredients_json); } catch(e){}
        }
        ings = ings.map((ing:any) => {
          let ingName = "Unknown";
          let ingUnit = "";
          if (ing.ingredient_type === "BASE_INGREDIENT") {
            const found = baseIngredients.find(b => b.id === ing.ingredient_id);
            if (found) { ingName = found.name; ingUnit = units.find((u:any) => u.id === found.base_unit)?.name || found.base_unit; }
          } else {
            const found = activeSemiProducts.find(s => s.id === ing.ingredient_id);
            if (found) { ingName = found.name; ingUnit = units.find((u:any) => u.id === found.base_unit)?.name || found.base_unit; }
          }
          return { ...ing, name: ingName, unitName: ingUnit };
        });
        
        const vName = productVariants.find(v => v.id === r.target_id)?.size_name || "";
        return { ...r, ingredients: ings, size_name: vName };
      })
      .sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { ...p, variants: variantsWithRecipes, priceHistory: pPriceHistory, recipeHistory: pRecipeHistory };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Thành phẩm (Menu)</h1>
          <p className="text-gray-500 mt-1">Quản lý Menu bán hàng, cấu hình Size và Định mức pha chế.</p>
        </div>
        <div className="flex items-center gap-3">
          <ProductForm 
            categories={activeCategories}
            baseIngredients={activeBaseIngredients}
            semiProducts={activeSemiProducts}
            units={units}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {enhancedProducts.map(product => {
          const categoryName = activeCategories.find(c => c.id === product.category_id)?.name || "Chưa phân loại";
          
          return (
            <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition">
              <div className="h-32 bg-gray-50 flex items-center justify-center border-b border-gray-100 relative group">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-4xl">☕</div>
                )}
                <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-xs font-bold text-indigo-700 border border-indigo-100 shadow-sm">
                  {categoryName}
                </div>
              </div>
              
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h3>
                </div>

                <div className="space-y-3 flex-1">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Các kích cỡ & Giá:</h4>
                  {product.variants.map((v:any, idx:number) => {
                    const ingCount = v.ingredients.length;
                    return (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <div>
                          <div className="font-bold text-gray-800 text-sm">{v.size_name}</div>
                          {ingCount > 0 ? (
                            <div className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded w-fit mt-1">
                              Đã có định mức ({ingCount})
                            </div>
                          ) : (
                            <div className="text-[11px] font-medium text-red-500 bg-red-50 px-1.5 py-0.5 rounded w-fit mt-1">
                              Chưa có định mức
                            </div>
                          )}
                        </div>
                        <div className="font-black text-orange-600">
                          {Number(v.price).toLocaleString('vi-VN')}đ
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100 flex justify-end gap-3 items-center">
                  <HistoryModal 
                    title={product.name}
                    recipeHistory={product.recipeHistory}
                    priceHistory={product.priceHistory}
                  />
                  <ProductForm 
                    categories={activeCategories}
                    baseIngredients={activeBaseIngredients}
                    semiProducts={activeSemiProducts}
                    units={units}
                    initialData={product}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {enhancedProducts.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 text-center py-16 px-4">
          <div className="w-16 h-16 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Chưa có món nào trên Menu</h3>
          <p className="text-gray-500 mb-4">Bạn chưa thiết lập bất kỳ Thành phẩm nào.</p>
        </div>
      )}
    </div>
  );
}
