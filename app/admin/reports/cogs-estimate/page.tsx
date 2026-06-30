import { findAll } from "@/lib/sheets_db";
import { getMacUnitCostWithRecipeFallback, MacSemiProductContext } from "@/lib/mac-cogs";

export const dynamic = "force-dynamic";

export default async function CogsEstimatePage() {
  const [categories, products, variants, recipes, baseIngredients, semiProducts, ledger]: [any[], any[], any[], any[], any[], any[], any[]] = await Promise.all([
    findAll("Product_Categories"),
    findAll("Products"),
    findAll("Product_Variants"),
    findAll("Recipes"),
    findAll("Base_Ingredients"),
    findAll("Semi_Products"),
    findAll("Stock_Ledger")
  ]);

  const activeCategories = categories.filter(c => c.status !== "DELETED");
  const activeProducts = products.filter(p => p.status !== "DELETED");
  const activeVariants = variants.filter(v => v.status !== "DELETED");
  
  const activeBaseIngredients = baseIngredients.filter(b => b.status !== "DELETED");
  const activeSemiProducts = semiProducts.filter(s => s.status !== "DELETED");

  const semiProductRecipes = new Map();
  const semiProductYields = new Map();
  for (const s of activeSemiProducts) {
    const r = recipes.find((x: any) => x.target_type === "SEMI_PRODUCT" && x.target_id === s.id);
    if (r && r.ingredients_json) {
      try { semiProductRecipes.set(s.id, JSON.parse(r.ingredients_json)); } catch (e) {}
      semiProductYields.set(s.id, r.yield_quantity ? Number(r.yield_quantity) : 1);
    }
  }
  const semiContext: MacSemiProductContext = { semiProductRecipes, semiProductYields };
  
  const now = new Date().toISOString();

  // Calculate MAC mapping
  const macMap = new Map();
  for (const b of activeBaseIngredients) {
    macMap.set(b.id, getMacUnitCostWithRecipeFallback(b.id, ledger, now, semiContext));
  }
  for (const s of activeSemiProducts) {
    macMap.set(s.id, getMacUnitCostWithRecipeFallback(s.id, ledger, now, semiContext));
  }

  // Calculate expected COGS for each variant
  const reportData = activeProducts.flatMap(product => {
    const pVariants = activeVariants.filter(v => v.product_id === product.id);
    const categoryName = activeCategories.find(c => c.id === product.category_id)?.name || "N/A";

    return pVariants.map(variant => {
      const recipe = recipes.find((r: any) => r.target_type === "PRODUCT_VARIANT" && r.target_id === variant.id);
      let ingredients: any[] = [];
      if (recipe && recipe.ingredients_json) {
        try { ingredients = JSON.parse(recipe.ingredients_json); } catch(e){}
      }

      let cogs = 0;
      for (const ing of ingredients) {
        if (!ing.ingredient_id) continue;
        const mac = macMap.get(ing.ingredient_id) || 0;
        cogs += mac * (ing.quantity || 0);
      }

      const price = Number(variant.price) || 0;
      const margin = price > 0 ? ((price - cogs) / price) * 100 : 0;

      return {
        productName: product.name,
        categoryName,
        sizeName: variant.size_name,
        price,
        cogs,
        margin
      };
    });
  });

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dự kiến Giá vốn (COGS)</h1>
          <p className="text-gray-500 mt-1">Tính toán giá vốn dự kiến của từng món dựa trên giá nhập hiện tại (MAC) của nguyên vật liệu.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 text-gray-700 text-sm border-b border-gray-200">
              <th className="p-3 font-bold">Món</th>
              <th className="p-3 font-bold">Nhóm</th>
              <th className="p-3 font-bold">Size</th>
              <th className="p-3 font-bold text-right">Giá bán (VNĐ)</th>
              <th className="p-3 font-bold text-right text-orange-600">Giá vốn dự kiến (VNĐ)</th>
              <th className="p-3 font-bold text-right text-indigo-600">Tỷ suất LN (Margin)</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors text-sm">
                <td className="p-3 font-medium text-gray-900">{row.productName}</td>
                <td className="p-3 text-gray-600">{row.categoryName}</td>
                <td className="p-3 text-gray-600">{row.sizeName}</td>
                <td className="p-3 text-right font-bold text-gray-700">{row.price.toLocaleString()}</td>
                <td className="p-3 text-right font-bold text-orange-600">{Math.round(row.cogs).toLocaleString()}</td>
                <td className="p-3 text-right font-bold text-indigo-600">{row.margin.toFixed(2)}%</td>
              </tr>
            ))}
            {reportData.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500 italic">Chưa có dữ liệu món ăn.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
