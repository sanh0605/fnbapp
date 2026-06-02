import { findAll } from "@/lib/sheets_db";
import SemiProductForm from "@/components/SemiProductForm";
import { deleteSemiProduct } from "@/app/actions/recipes";
import { DeleteBtn } from "@/components/InventoryForms";
import HistoryModal from "@/components/HistoryModal";

export default async function SemiProductsPage() {
  const [semiProducts, recipes, baseIngredients, allUnits] = await Promise.all([
    findAll("Semi_Products"),
    findAll("Recipes"),
    findAll("Base_Ingredients"),
    findAll("Units")
  ]);

  const activeSemiProducts = semiProducts.filter(sp => sp.status !== "DELETED");
  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Bán Thành Phẩm & Công Thức</h1>
          <p className="text-gray-500 mt-1">Quản lý định mức mẻ nấu cho các chế phẩm nội bộ.</p>
        </div>
        <SemiProductForm 
          units={units} 
          baseIngredients={baseIngredients} 
          semiProducts={activeSemiProducts} 
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {activeSemiProducts.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Chưa có Bán thành phẩm nào</h3>
            <p className="text-gray-500">Bắt đầu bằng cách thêm Bán thành phẩm và khai báo công thức nấu.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4">Mã BTP</th>
                  <th className="px-6 py-4">Tên Bán Thành Phẩm</th>
                  <th className="px-6 py-4">Sản Lượng 1 Mẻ</th>
                  <th className="px-6 py-4">Công Thức (Thành phần)</th>
                  <th className="px-6 py-4 text-center">Trạng Thái</th>
                  <th className="px-6 py-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeSemiProducts.map((sp) => {
                  const recipe = recipes.find(r => r.target_type === "SEMI_PRODUCT" && r.target_id === sp.id);
                  let ingredients: any[] = [];
                  if (recipe?.ingredients_json) {
                    try { ingredients = JSON.parse(recipe.ingredients_json); } catch (e) {}
                  }

                  const unitName = units.find((u:any) => u.id === sp.base_unit)?.name || sp.base_unit;
                  
                  // Chuẩn bị dữ liệu Lịch sử Công thức
                  const spRecipeHistory = recipes
                    .filter(r => r.target_type === "SEMI_PRODUCT" && r.target_id === sp.id)
                    .map(r => {
                      let ings = [];
                      if (r.ingredients_json) {
                        try { ings = JSON.parse(r.ingredients_json); } catch(e){}
                      }
                      
                      // Map name and unit for history display
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
                      
                      return { ...r, ingredients: ings };
                    })
                    .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                  return (
                    <tr key={sp.id} className="hover:bg-gray-50/50 transition">
                      <td className="px-6 py-4 font-medium text-gray-900">{sp.id}</td>
                      <td className="px-6 py-4 font-bold text-indigo-700">{sp.name}</td>
                      <td className="px-6 py-4 font-semibold text-emerald-600">
                        {sp.batch_yield} {unitName}
                      </td>
                      <td className="px-6 py-4">
                        {ingredients.length === 0 ? (
                          <span className="text-gray-400 italic">Chưa khai báo</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {ingredients.map((ing, idx) => {
                              let ingName = "Unknown";
                              let ingUnit = "";
                              if (ing.ingredient_type === "BASE_INGREDIENT") {
                                const found = baseIngredients.find(b => b.id === ing.ingredient_id);
                                if (found) {
                                  ingName = found.name;
                                  ingUnit = units.find((u:any) => u.id === found.base_unit)?.name || found.base_unit;
                                }
                              } else {
                                const found = activeSemiProducts.find(s => s.id === ing.ingredient_id);
                                if (found) {
                                  ingName = found.name;
                                  ingUnit = units.find((u:any) => u.id === found.base_unit)?.name || found.base_unit;
                                }
                              }
                              
                              return (
                                <span key={idx} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-white border border-gray-200 text-gray-600 shadow-sm">
                                  {ingName}: <span className="text-indigo-600 font-bold ml-1">{ing.quantity} {ingUnit}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          sp.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {sp.status === 'ACTIVE' ? 'Đang dùng' : 'Tạm ngưng'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <HistoryModal 
                            title={sp.name}
                            recipeHistory={spRecipeHistory}
                          />
                          <SemiProductForm 
                            units={units} 
                            baseIngredients={baseIngredients} 
                            semiProducts={activeSemiProducts} 
                            initialData={sp}
                            initialRecipe={recipe}
                          />
                          <DeleteBtn id={sp.id} actionFn={deleteSemiProduct} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
