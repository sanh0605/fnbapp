"use client";

import { useState } from "react";
import { saveModifier, deleteModifier } from "@/app/actions/modifiers";

export default function ModifierForm({ baseIngredients, semiProducts, units, initialData, initialRecipe }: any) {
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState(initialData?.name || "");
  const [groupName, setGroupName] = useState(initialData?.group_name || "Thêm Topping");
  const [price, setPrice] = useState(initialData?.price || 0);

  let parsedIngs = [];
  if (initialRecipe && initialRecipe.ingredients_json) {
    try { parsedIngs = JSON.parse(initialRecipe.ingredients_json); } catch(e){}
  }
  const [ingredients, setIngredients] = useState<any[]>(parsedIngs);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !groupName) return alert("Vui lòng nhập tên và chọn nhóm tuỳ chọn.");
    
    setLoading(true);
    const formData = new FormData();
    formData.append("is_edit", isEdit ? "true" : "false");
    if (isEdit) formData.append("id", initialData.id);
    formData.append("name", name);
    formData.append("group_name", groupName);
    formData.append("price", price.toString());
    formData.append("ingredients_json", JSON.stringify(ingredients));

    const res = await saveModifier(formData);
    setLoading(false);

    if (res.success) {
      setIsOpen(false);
      if (!isEdit) {
        setName("");
        setPrice(0);
        setIngredients([]);
      }
    } else {
      alert("Lỗi: " + res.error);
    }
  };

  const handleDelete = async () => {
    if (confirm(`Bạn có chắc muốn xoá ${initialData.name}?`)) {
      const formData = new FormData();
      formData.append("id", initialData.id);
      await deleteModifier(formData);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { ingredient_id: "", ingredient_type: "BASE_INGREDIENT", quantity: 0 }]);
  };
  const updateIngredient = (index: number, field: string, value: any) => {
    const newIngs = [...ingredients];
    newIngs[index][field] = value;
    setIngredients(newIngs);
  };
  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  return (
    <>
      {!isEdit ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition shadow-sm"
        >
          + Thêm Tuỳ chọn
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setIsOpen(true)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Sửa</button>
          <button onClick={handleDelete} className="text-sm font-medium text-red-600 hover:text-red-800">Xoá</button>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">
                {isEdit ? "Sửa Tuỳ chọn" : "Thêm Tuỳ chọn mới"}
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <form id={isEdit ? `editMod-${initialData.id}` : "addMod"} onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nhóm tuỳ chọn</label>
                    <select required value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-orange-500">
                      <option value="Thêm Topping">Thêm Topping</option>
                      <option value="Mức Đường">Mức Đường (Ghi chú)</option>
                      <option value="Mức Đá">Mức Đá (Ghi chú)</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Giá bán thêm (Nếu có)</label>
                    <input type="number" min="0" required value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-orange-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tên Tuỳ chọn (VD: Trân châu trắng, 50% Đường)</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-orange-500" placeholder="Nhập tên..." />
                </div>

                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-gray-700">Định mức trừ kho (Cho Topping)</label>
                    <button type="button" onClick={addIngredient} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100">+ Thêm nguyên liệu</button>
                  </div>
                  
                  {ingredients.length === 0 ? (
                    <div className="text-xs text-gray-500 italic">Không cấu hình trừ kho (Dành cho Mức đường/đá).</div>
                  ) : (
                    <div className="space-y-2">
                      {ingredients.map((ing:any, iIdx:number) => (
                        <div key={iIdx} className="flex gap-2 items-center">
                          <select
                            value={ing.ingredient_type}
                            onChange={e => { updateIngredient(iIdx, "ingredient_type", e.target.value); updateIngredient(iIdx, "ingredient_id", ""); }}
                            className="w-1/3 text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
                          >
                            <option value="BASE_INGREDIENT">Nguyên liệu</option>
                            <option value="SEMI_PRODUCT">Bán thành phẩm</option>
                          </select>

                          <select
                            required
                            value={ing.ingredient_id}
                            onChange={e => updateIngredient(iIdx, "ingredient_id", e.target.value)}
                            className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white"
                          >
                            <option value="">- Chọn -</option>
                            {ing.ingredient_type === "BASE_INGREDIENT" 
                              ? baseIngredients.map((b:any) => <option key={b.id} value={b.id}>{b.name} ({units.find((u:any) => u.id === b.base_unit)?.name})</option>)
                              : semiProducts.map((s:any) => <option key={s.id} value={s.id}>{s.name} ({units.find((u:any) => u.id === s.base_unit)?.name})</option>)
                            }
                          </select>

                          <input
                            type="number" required min="0.001" step="any" placeholder="SL"
                            value={ing.quantity || ""}
                            onChange={e => updateIngredient(iIdx, "quantity", Number(e.target.value))}
                            className="w-20 text-sm text-right font-bold text-red-600 border border-gray-300 rounded-md px-2 py-1.5"
                          />
                          
                          <button type="button" onClick={() => removeIngredient(iIdx)} className="p-1.5 text-gray-400 hover:text-red-500">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 mt-auto">
              <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">Huỷ</button>
              <button type="submit" form={isEdit ? `editMod-${initialData.id}` : "addMod"} disabled={loading} className="px-5 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50">
                {loading ? "Đang lưu..." : "Lưu Tuỳ Chọn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
