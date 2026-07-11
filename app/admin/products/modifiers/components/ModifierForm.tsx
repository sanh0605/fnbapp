"use client";

import { useState, useId } from "react";
import { saveModifierAction } from "../actions";
import { SearchableSelect } from "@/components/SearchableSelect";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Button } from "@/components/ui/Button";
import { Plus } from "lucide-react";
import type { DBModifier, DBRecipe, DBBaseIngredient, DBSemiProduct, DBUnit } from "@/types/db";
import {
  normalizeModifierIngredients,
  normalizeQuantityInput,
  parseModifierIngredients,
  validateModifierIngredients,
} from "@/lib/modifier-recipe";

interface ModifierFormProps {
  baseIngredients: DBBaseIngredient[];
  semiProducts: DBSemiProduct[];
  units: DBUnit[];
  initialData?: DBModifier & { activeRecipe?: DBRecipe };
}

export function ModifierForm({ baseIngredients, semiProducts, units, initialData }: ModifierFormProps) {
  const formId = useId();
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name || "");
  const [groupName, setGroupName] = useState(initialData?.group_name || "Thêm Topping");
  const [price, setPrice] = useState(initialData?.price || "0");
  const [ingredients, setIngredients] = useState<any[]>(
    parseModifierIngredients(initialData?.activeRecipe?.ingredients_json),
  );

  const baseIngredientOptions = baseIngredients.map((bi) => ({ id: bi.id, label: bi.name }));
  const semiProductOptions = semiProducts.map((sp) => ({ id: sp.id, label: sp.name }));

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

    const cleanedIngredients = ingredients.filter((ing) => ing.ingredient_id);
    const validation = validateModifierIngredients(cleanedIngredients);
    if (!validation.ok) {
      setError(validation.error);
      setLoading(false);
      return;
    }

    formData.append("is_edit", String(isEdit));
    if (isEdit) formData.append("id", initialData!.id);
    formData.append("name", name);
    formData.append("group_name", groupName);
    formData.append("price", price);
    formData.append("ingredients_json", JSON.stringify(normalizeModifierIngredients(cleanedIngredients)));

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
        <Button variant="ghost" size="sm" onClick={() => setIsOpen(true)} className="mr-2">Sửa</Button>
      ) : (
        <Button variant="primary" onClick={() => setIsOpen(true)}><Plus size={16} className="mr-2" /> Thêm Tùy Chọn</Button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title={isEdit ? "Sửa Tùy Chọn" : "Thêm Tùy Chọn Mới"}
        maxWidth="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>Hủy</Button>
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
            <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${formId}-groupName`} className="block text-sm font-medium text-text-secondary mb-1">Nhóm Tùy Chọn</label>
              <select
                id={`${formId}-groupName`}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
              >
                <option value="Thêm Topping">Thêm Topping</option>
                <option value="Chọn Size">Chọn Size</option>
                <option value="Chọn Đường">Chọn Đường</option>
                <option value="Chọn Đá">Chọn Đá</option>
              </select>
            </div>
            <div>
              <label htmlFor={`${formId}-price`} className="block text-sm font-medium text-text-secondary mb-1">Giá thêm (đ)</label>
              <input
                id={`${formId}-price`}
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">Tên Tùy Chọn</label>
            <input
              id={`${formId}-name`}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
              placeholder="VD: Trân châu trắng, Size L..."
            />
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-bold text-text-primary">Định mức nguyên liệu (Recipe)</h4>
              <button
                type="button"
                onClick={addIngredient}
                className="text-xs font-bold text-primary bg-primary-soft px-2 py-1 rounded hover:bg-primary/20 transition"
              >
                + Thêm nguyên liệu
              </button>
            </div>

            <div className="space-y-2">
              {ingredients.map((ing: any, idx: number) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 sm:grid-cols-[128px_minmax(0,1fr)_96px_32px] gap-2 items-start bg-surface-secondary p-2.5 rounded-lg border border-border"
                >
                  <select
                    value={ing.ingredient_type}
                    onChange={(e) => updateIngredient(idx, { ingredient_type: e.target.value, ingredient_id: "" })}
                    className="w-full h-9 border border-border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
                  >
                    <option value="BASE_INGREDIENT">Nguyên liệu</option>
                    <option value="SEMI_PRODUCT">Bán thành phẩm</option>
                  </select>

                  <div className="min-w-0">
                    <SearchableSelect
                      options={ing.ingredient_type === "BASE_INGREDIENT" ? baseIngredientOptions : semiProductOptions}
                      value={ing.ingredient_id}
                      onChange={(value) => updateIngredient(idx, { ingredient_id: value })}
                      placeholder="Chọn nguyên liệu..."
                      className="h-9 py-1.5 text-xs border-border"
                    />
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={ing.quantity}
                      onFocus={() => {
                        if (String(ing.quantity) === "0") updateIngredient(idx, { quantity: "" });
                      }}
                      onChange={(e) => updateIngredient(idx, { quantity: normalizeQuantityInput(e.target.value) })}
                      className="w-full h-9 border border-border rounded-lg pl-2 pr-7 py-1.5 text-xs outline-none focus:ring-2 focus:ring-focus-ring text-right"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-text-muted font-medium pointer-events-none">
                      {(() => {
                        const source = ing.ingredient_type === "BASE_INGREDIENT"
                          ? baseIngredients.find((bi) => bi.id === ing.ingredient_id)
                          : semiProducts.find((sp) => sp.id === ing.ingredient_id);
                        return units.find((u) => u.id === source?.base_unit)?.name || "";
                      })()}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="h-9 w-8 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10"
                  >
                    ×
                  </button>
                </div>
              ))}
              {ingredients.length === 0 && (
                <div className="text-center py-4 text-xs text-text-muted italic">
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
