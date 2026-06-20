import { findAll } from "@/lib/sheets_db";
import ModifierForm from "@/components/ModifierForm";
import { deleteModifier } from "@/app/actions/modifiers";
import { DeleteBtn } from "@/components/InventoryForms";
import HistoryModal from "@/components/HistoryModal";

export const dynamic = "force-dynamic";

export default async function ModifiersPage() {
  const [modifiers, recipes, baseIngredients, semiProducts, allUnits] = await Promise.all([
    findAll("Modifiers"),
    findAll("Recipes"),
    findAll("Base_Ingredients"),
    findAll("Semi_Products"),
    findAll("Units")
  ]);

  const activeModifiers = modifiers.filter(m => m.status !== "DELETED");
  const units = allUnits.filter(u => u.name && !u.name.startsWith("DELETED_"));
  const activeBaseIngredients = baseIngredients.filter(b => b.status !== "DELETED");
  const activeSemiProducts = semiProducts.filter(s => s.status !== "DELETED");

  const modifiersWithRecipes = activeModifiers.map(m => {
    // Find active recipe
    const activeRecipe = recipes.find(r => r.target_type === "MODIFIER" && r.target_id === m.id && (!r.end_date || r.end_date === ""));
    
    // History
    const recipeHistory = recipes
      .filter(r => r.target_type === "MODIFIER" && r.target_id === m.id)
      .map(r => {
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
            const found = semiProducts.find(s => s.id === ing.ingredient_id);
            if (found) { ingName = found.name; ingUnit = units.find((u:any) => u.id === found.base_unit)?.name || found.base_unit; }
          }
          return { ...ing, name: ingName, unitName: ingUnit };
        });
        return { ...r, ingredients: ings };
      })
      .sort((a:any, b:any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { ...m, activeRecipe, recipeHistory };
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tuỳ chọn mở (Modifiers)</h1>
          <p className="text-gray-500 mt-1">Quản lý Topping, Mức Đường, Mức Đá và cấu hình trừ kho tự động cho Topping.</p>
        </div>
        <ModifierForm 
          baseIngredients={activeBaseIngredients}
          semiProducts={activeSemiProducts}
          units={units}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {modifiersWithRecipes.length === 0 ? (
          <div className="text-center py-16 px-4">
            <h3 className="text-lg font-medium text-gray-900 mb-1">Chưa có Tuỳ chọn nào</h3>
            <p className="text-gray-500">Thêm các loại Topping hoặc ghi chú để hiển thị trên POS.</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50/80 text-gray-500 font-medium border-b border-gray-100">
              <tr>
                <th className="px-6 py-4">Nhóm</th>
                <th className="px-6 py-4">Tên Lựa Chọn</th>
                <th className="px-6 py-4">Giá bán thêm</th>
                <th className="px-6 py-4">Định mức trừ kho</th>
                <th className="px-6 py-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {modifiersWithRecipes.map(m => {
                let ings = [];
                if (m.activeRecipe?.ingredients_json) {
                  try { ings = JSON.parse(m.activeRecipe.ingredients_json); } catch(e){}
                }

                return (
                  <tr key={m.id} className="hover:bg-gray-50/50 transition">
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-1 bg-gray-100 rounded text-xs font-bold text-gray-600">
                        {m.group_name}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">{m.name}</td>
                    <td className="px-6 py-4 font-bold text-orange-600">
                      {Number(m.price) > 0 ? `+${Number(m.price).toLocaleString('vi-VN')} đ` : "0 đ"}
                    </td>
                    <td className="px-6 py-4">
                      {ings.length === 0 ? (
                        <span className="text-gray-400 italic text-xs">Không trừ kho</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {ings.map((ing:any, idx:number) => {
                            let ingName = "Unknown";
                            let ingUnit = "";
                            if (ing.ingredient_type === "BASE_INGREDIENT") {
                              const found = activeBaseIngredients.find(b => b.id === ing.ingredient_id);
                              if (found) { ingName = found.name; ingUnit = units.find((u:any) => u.id === found.base_unit)?.name || found.base_unit; }
                            } else {
                              const found = activeSemiProducts.find(s => s.id === ing.ingredient_id);
                              if (found) { ingName = found.name; ingUnit = units.find((u:any) => u.id === found.base_unit)?.name || found.base_unit; }
                            }
                            return (
                              <span key={idx} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium border border-gray-200">
                                {ingName}: <b className="text-indigo-600 ml-1">{ing.quantity} {ingUnit}</b>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {ings.length > 0 && (
                          <HistoryModal title={m.name} recipeHistory={m.recipeHistory} />
                        )}
                        <ModifierForm 
                          initialData={m}
                          initialRecipe={m.activeRecipe}
                          baseIngredients={activeBaseIngredients}
                          semiProducts={activeSemiProducts}
                          units={units}
                        />
                        <DeleteBtn id={m.id} actionFn={deleteModifier} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
