"use client";

import { useState, useId } from "react";
import { saveSemiProduct } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CustomDatePicker } from "@/components/CustomDatePicker";
import type { DBSemiProduct, DBRecipe, DBBaseIngredient, DBUnit } from "@/types/db";

interface SemiProductFormProps {
  units: DBUnit[];
  baseIngredients: DBBaseIngredient[];
  semiProducts: DBSemiProduct[];
  initialData?: DBSemiProduct;
  initialRecipe?: DBRecipe;
}

export function SemiProductForm({ units, baseIngredients, semiProducts, initialData, initialRecipe }: SemiProductFormProps) {
  const formId = useId();
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initialData?.name || "");
  const [baseUnit, setBaseUnit] = useState(initialData?.base_unit || "");
  const [batchYield, setBatchYield] = useState(initialData?.batch_yield || "");
  const [status, setStatus] = useState(initialData?.status || "ACTIVE");
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(null);
  
  const initialIngredients = initialRecipe?.ingredients_json 
    ? JSON.parse(initialRecipe.ingredients_json) 
    : [];
    
  const [ingredients, setIngredients] = useState<any[]>(initialIngredients);

  const unitOptions = units.map(u => ({ id: u.id, label: u.name }));
  
  // Prevent self-reference in ingredients
  const availableSemiProducts = semiProducts.filter(s => s.id !== initialData?.id);

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

  function getIngredientBaseUnit(type: string, id: string) {
    if (!id) return "";
    let sourceUnitId = "";
    if (type === "BASE_INGREDIENT") {
      sourceUnitId = baseIngredients.find(b => b.id === id)?.base_unit || "";
    } else {
      sourceUnitId = semiProducts.find(s => s.id === id)?.base_unit || "";
    }
    return units.find(u => u.id === sourceUnitId)?.name || "";
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (!name || !baseUnit || !batchYield) {
      setError("Vui lòng nhập đầy đủ thông tin tên, đơn vị, và mẻ chuẩn");
      setLoading(false);
      return;
    }

    const validIngredients = ingredients.filter(ing => ing.ingredient_id && Number(ing.quantity) > 0);
    if (validIngredients.length === 0) {
      setError("Phải có ít nhất 1 thành phần nguyên liệu");
      setLoading(false);
      return;
    }

    formData.append("is_edit", String(isEdit));
    if (isEdit) formData.append("id", initialData!.id);
    formData.append("name", name);
    formData.append("base_unit", baseUnit);
    formData.append("batch_yield", batchYield);
    formData.append("status", status);
    formData.append("ingredients_json", JSON.stringify(validIngredients));
    if (effectiveDate) {
      formData.append("effective_date", effectiveDate.toISOString());
    }

    const res = await saveSemiProduct(formData);
    setLoading(false);
    
    if (res.error) {
      setError(res.error);
    } else {
      setIsOpen(false);
      if (!isEdit) {
        setName("");
        setBaseUnit("");
        setBatchYield("");
        setIngredients([]);
        setEffectiveDate(null);
      }
    }
  }

  return (
    <>
      {isEdit ? (
        <button
          onClick={() => setIsOpen(true)}
          className="text-primary hover:text-primary-hover font-medium text-sm mr-4"
        >
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition transition"
        >
          + Thêm Bán Thành Phẩm
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title={isEdit ? "Sửa Bán Thành Phẩm" : "Thêm Bán Thành Phẩm"}
        maxWidth="max-w-3xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium"
            >
              Hủy
            </button>
            <LoadingButton
              type="submit"
              form="semi-product-form"
              loading={loading}
              loadingText="Đang lưu..."
            >
              {isEdit ? "Cập nhật" : "Lưu Bán Thành Phẩm"}
            </LoadingButton>
          </>
        }
      >
        <form id="semi-product-form" action={handleSubmit} className="space-y-6">
          {error && (
            <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-text-secondary mb-1">Tên Bán Thành Phẩm</label>
              <input
                id={`${formId}-name`}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring"
                placeholder="VD: Trà đen ủ, Trân châu nấu..."
              />
            </div>
            
            <div>
              <label htmlFor={`${formId}-baseUnit`} className="block text-sm font-medium text-text-secondary mb-1">Đơn vị quản lý (cơ bản)</label>
              <SearchableSelect
                id={`${formId}-baseUnit`}
                options={unitOptions}
                value={baseUnit}
                onChange={setBaseUnit}
                placeholder="VD: ml, g..."
              />
            </div>

            <div>
              <label htmlFor={`${formId}-batchYield`} className="block text-sm font-medium text-text-secondary mb-1">Quy mô mẻ chuẩn (Batch Yield)</label>
              <div className="flex items-center gap-2">
                <input
                  id={`${formId}-batchYield`}
                  type="number"
                  step="any"
                  value={batchYield}
                  onChange={(e) => setBatchYield(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring"
                  placeholder="VD: 5000"
                />
                <span className="text-text-muted font-medium text-sm w-12">
                  {units.find(u => u.id === baseUnit)?.name || "---"}
                </span>
              </div>
            </div>

            {isEdit && (
              <>
                <div>
                  <label htmlFor={`${formId}-status`} className="block text-sm font-medium text-text-secondary mb-1">Trạng thái</label>
                  <select
                    id={`${formId}-status`}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
                  >
                    <option value="ACTIVE">Đang sử dụng</option>
                    <option value="INACTIVE">Ngừng sử dụng</option>
                  </select>
                </div>
                <div>
                  <label htmlFor={`${formId}-effectiveDate`} className="block text-sm font-medium text-text-secondary mb-1">Ngày áp dụng công thức (Nếu đổi)</label>
                  <CustomDatePicker
                    id={`${formId}-effectiveDate`}
                    selected={effectiveDate}
                    onChange={setEffectiveDate}
                    placeholderText="Mặc định: Ngay lúc này"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
                  />
                  <p className="text-[10px] text-text-muted mt-1">Để trống hệ thống sẽ ghi nhận thay đổi từ lúc bấm lưu.</p>
                </div>
              </>
            )}
          </div>

          <div className="pt-4 border-t border-border">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h4 className="text-base font-bold text-text-primary">Công thức (Recipe) cho mẻ chuẩn</h4>
                <p className="text-xs text-text-muted">Định lượng để tạo ra {batchYield || "0"} {units.find(u => u.id === baseUnit)?.name || "đơn vị"}</p>
              </div>
              <button
                type="button"
                onClick={addIngredient}
                className="text-xs font-bold text-primary bg-primary-soft px-3 py-1.5 rounded-lg hover:bg-primary/20 transition"
              >
                + Thêm thành phần
              </button>
            </div>

            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-surface-secondary p-3 rounded-xl border border-border">
                  <select
                    value={ing.ingredient_type}
                    onChange={(e) => updateIngredient(idx, { ingredient_type: e.target.value, ingredient_id: "" })}
                    className="w-40 border border-border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
                  >
                    <option value="BASE_INGREDIENT">Nguyên liệu thô</option>
                    <option value="SEMI_PRODUCT">Bán thành phẩm</option>
                  </select>

                  <div className="flex-1">
                    <select
                      value={ing.ingredient_id}
                      onChange={(e) => updateIngredient(idx, { ingredient_id: e.target.value })}
                      className="w-full border border-border rounded-lg px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring bg-surface-card"
                    >
                      <option value="">-- Chọn --</option>
                      {ing.ingredient_type === "BASE_INGREDIENT" 
                        ? baseIngredients.map(bi => <option key={bi.id} value={bi.id}>{bi.name}</option>)
                        : availableSemiProducts.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)
                      }
                    </select>
                  </div>

                  <div className="w-32 relative">
                    <input
                      type="number"
                      step="any"
                      value={ing.quantity}
                      onChange={(e) => updateIngredient(idx, { quantity: e.target.value })}
                      className="w-full border border-border rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring font-mono text-right"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted font-bold">
                      {getIngredientBaseUnit(ing.ingredient_type, ing.ingredient_id)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="p-2 text-text-muted hover:text-danger transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {ingredients.length === 0 && (
                <div className="text-center py-6 text-sm text-text-muted border-2 border-dashed border-border rounded-xl">
                  Chưa có thành phần nguyên liệu. Nhấn "+ Thêm thành phần"
                </div>
              )}
            </div>
          </div>
        </form>
      </FormModal>
    </>
  );
}
