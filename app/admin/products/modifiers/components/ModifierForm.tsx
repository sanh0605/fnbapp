"use client";

import { useState } from "react";
import { saveModifierAction } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import type { DBModifier, DBRecipe, DBBaseIngredient, DBSemiProduct, DBUnit } from "@/types/db";

interface ModifierFormProps {
  baseIngredients: DBBaseIngredient[];
  semiProducts: DBSemiProduct[];
  units: DBUnit[];
  initialData?: DBModifier & { activeRecipe?: DBRecipe };
}

export function ModifierForm({ baseIngredients, semiProducts, units, initialData }: ModifierFormProps) {
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name || "");
  const [groupName, setGroupName] = useState(initialData?.group_name || "Thêm Topping");
  const [price, setPrice] = useState(initialData?.price || "0");
  
  const initialIngredients = initialData?.activeRecipe?.ingredients_json 
    ? JSON.parse(initialData.activeRecipe.ingredients_json) 
    : [];
    
  const [ingredients, setIngredients] = useState<any[]>(initialIngredients);

  function addIngredient() {
    setIngredients([...ingredients, { ingredient_type: "BASE_INGREDIENT", ingredient_id: "", quantity: "0" }]);
  }

  function updateIngredient(idx: number, fields: any) {
    const newIngs = [...ingredients];
    newIngs[idx] = { ...newIngs[idx], ...fields };
    setIngredients(newIngs);
  }

  function removeIngredient(idx: number) {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (!name || !groupName) {
      setError("Vui lòng nhập đầy đủ thông tin");
      setLoading(false);
      return;
    }

    formData.append("is_edit", String(isEdit));
    if (isEdit) formData.append("id", initialData!.id);
    formData.append("name", name);
    formData.append("group_name", groupName);
    formData.append("price", price);
    formData.append("ingredients_json", JSON.stringify(ingredients.filter(ing => ing.ingredient_id)));

    const res = await saveModifierAction(formData);
    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
      if (!isEdit) {
        setName("");
        setPrice("0");
        setIngredients([]);
      }
    }
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-4"
        >
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
        >
          + Thêm Tùy Chọn
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title={isEdit ? "Sửa Tùy Chọn" : "Thêm Tùy Chọn Mới"}
        maxWidth="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium"
            >
              Hủy
            </button>
            <LoadingButton
              type="submit"
              form="modifier-form"
              loading={loading}
              loadingText="Đang lưu..."
            >
              {isEdit ? "Cập nhật" : "Lưu Tùy Chọn"}
            </LoadingButton>
          </>
        }
      >
        <form id="modifier-form" action={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nhóm Tùy Chọn</label>
              <select
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
              >
                <option value="Thêm Topping">Thêm Topping</option>
                <option value="Chọn Size">Chọn Size</option>
                <option value="Chọn Đường">Chọn Đường</option>
                <option value="Chọn Đá">Chọn Đá</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giá thêm (đ)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên Tùy Chọn</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-gray-900"
              placeholder="VD: Trân châu trắng, Size L..."
            />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-gray-900">Định mức nguyên liệu (Recipe)</h4>
              <button
                type="button"
                onClick={addIngredient}
                className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition"
              >
                + Thêm nguyên liệu
              </button>
            </div>

            <div className="space-y-2">
              {ingredients.map((ing: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <select
                    value={ing.ingredient_type}
                    onChange={(e) => updateIngredient(idx, { ingredient_type: e.target.value, ingredient_id: "" })}
                    className="w-32 border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="BASE_INGREDIENT">Nguyên liệu</option>
                    <option value="SEMI_PRODUCT">Bán thành phẩm</option>
                  </select>

                  <select
                    value={ing.ingredient_id}
                    required
                    onChange={(e) => updateIngredient(idx, { ingredient_id: e.target.value })}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="">Chọn...</option>
                    {ing.ingredient_type === "BASE_INGREDIENT" 
                      ? baseIngredients.map(bi => <option key={bi.id} value={bi.id}>{bi.name}</option>)
                      : semiProducts.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)
                    }
                  </select>

                  <div className="w-20 relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={ing.quantity}
                      onChange={(e) => updateIngredient(idx, { quantity: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg pl-2 pr-6 py-1.5 text-xs outline-none focus:border-blue-500"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium">
                      {(() => {
                        const source = ing.ingredient_type === "BASE_INGREDIENT" 
                          ? baseIngredients.find(bi => bi.id === ing.ingredient_id)
                          : semiProducts.find(sp => sp.id === ing.ingredient_id);
                        return units.find(u => u.id === source?.base_unit)?.name || "";
                      })()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {ingredients.length === 0 && (
                <div className="text-center py-4 text-xs text-gray-400 italic">
                  Chưa có định mức cho tùy chọn này.
                </div>
              )}
            </div>
          </div>
        </form>
      </FormModal>
    </>
  );
}
