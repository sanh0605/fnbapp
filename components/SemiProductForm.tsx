"use client";

import { useState } from "react";
import { saveSemiProduct } from "@/app/admin/semi-products/actions";
import { SearchableSelect } from "./SearchableSelect";
import { CustomDatePicker } from "./CustomDatePicker";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { alert, confirm } from "@/lib/dialog";

export default function SemiProductForm({ units, baseIngredients, semiProducts, initialData, initialRecipe }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const isEdit = !!initialData;
  const [name, setName] = useState(initialData?.name || "");
  const [baseUnit, setBaseUnit] = useState(initialData?.base_unit || "");
  const [batchYield, setBatchYield] = useState<string | number>(initialData?.batch_yield || 1);
  const [status, setStatus] = useState(initialData?.status || "ACTIVE");
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(null);

  const [ingredients, setIngredients] = useState<any[]>(() => {
    if (initialRecipe?.ingredients_json) {
      try {
        return JSON.parse(initialRecipe.ingredients_json);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const addIngredient = () => {
    setIngredients([...ingredients, { ingredient_type: "BASE_INGREDIENT", ingredient_id: "", quantity: 1 }]);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const newIngs = [...ingredients];
    newIngs[index][field] = value;
    
    // Reset ID if type changes
    if (field === "ingredient_type") {
      newIngs[index].ingredient_id = "";
    }
    
    setIngredients(newIngs);
  };

  const getUnitName = (unitId: string) => {
    return units.find((u:any) => u.id === unitId)?.name || unitId;
  };

  const getIngredientBaseUnit = (ing: any) => {
    if (!ing.ingredient_id) return "";
    
    if (ing.ingredient_type === "BASE_INGREDIENT") {
      const found = baseIngredients.find((b:any) => b.id === ing.ingredient_id);
      return found ? getUnitName(found.base_unit) : "";
    } else {
      const found = semiProducts.find((s:any) => s.id === ing.ingredient_id);
      return found ? getUnitName(found.base_unit) : "";
    }
  };

  const handleUnitChange = (val: string) => {
    setBaseUnit(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!baseUnit) {
      return await alert({ title: "Thiếu thông tin", message: "Vui lòng chọn Đơn vị gốc từ danh sách gợi ý.", variant: "warning" });
    }
    
    if (ingredients.length === 0) {
      return await alert({ title: "Thiếu thông tin", message: "Vui lòng thêm ít nhất 1 thành phần công thức.", variant: "warning" });
    }
    
    for (let i = 0; i < ingredients.length; i++) {
      if (!ingredients[i].ingredient_id) {
        return await alert({ title: "Thiếu thông tin", message: `Thành phần dòng ${i + 1} chưa được chọn.`, variant: "warning" });
      }
      if (!ingredients[i].quantity || Number(ingredients[i].quantity) <= 0) {
        return await alert({ title: "Thiếu thông tin", message: `Số lượng dòng ${i + 1} không hợp lệ.`, variant: "warning" });
      }
    }

    setLoading(true);
    const effectiveDateStr = effectiveDate ? effectiveDate.toISOString() : "";
    const formData = new FormData();
    formData.append("is_edit", isEdit ? "true" : "false");
    if (isEdit) formData.append("id", initialData.id);
    
    formData.append("name", name);
    formData.append("base_unit", baseUnit);
    formData.append("batch_yield", batchYield.toString());
    formData.append("status", status);
    formData.append("ingredients_json", JSON.stringify(ingredients));
    formData.append("effective_date", effectiveDateStr);

    const res = await saveSemiProduct(formData);
    setLoading(false);

    if (res.success) {
      if (!isEdit) {
        setName("");
        setBaseUnit("");
        setBatchYield(1);
        setIngredients([]);
      }
      setIsOpen(false);
    } else {
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className={isEdit ? "text-primary hover:text-indigo-900 text-sm font-medium" : "px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition"}
      >
        {isEdit ? "Sửa" : "+ Thêm Bán Thành Phẩm"}
      </button>

      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border flex justify-between items-center bg-page/50">
              <h2 className="text-xl font-bold text-text-primary">{isEdit ? "Sửa Bán Thành Phẩm" : "Thêm Bán Thành Phẩm Mới"}</h2>
              <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-secondary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form id="semiProductForm" onSubmit={handleSubmit} className="space-y-6 pb-48">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-text-primary mb-1">Tên Bán Thành Phẩm *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ví dụ: Nước đường, Sốt Thái..."
                      className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Đơn vị lưu kho *</label>
                    <div className={!baseUnit ? 'border border-red-300 ring-1 ring-red-100 rounded-lg' : ''}>
                      <SearchableSelect
                        required
                        value={baseUnit}
                        onChange={handleUnitChange}
                        options={units.map((u: any) => ({ id: u.id, label: u.name }))}
                        placeholder="Chọn đơn vị..."
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Sản lượng 1 mẻ (Batch Yield) *</label>
                    <input
                      type="number"
                      required
                      min="0.1"
                      step="any"
                      value={batchYield}
                      onChange={(e) => setBatchYield(e.target.value === "" ? "" : e.target.value)}
                      className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring"
                    />
                  </div>
                  
                  <div className="col-span-2 mt-2 pt-4 border-t border-border">
                    <label className="block text-sm font-bold text-text-primary mb-1">Ngày áp dụng công thức (Tuỳ chọn)</label>
                    <p className="text-xs text-text-secondary mb-2">Bỏ trống hệ thống sẽ tự lấy thời điểm hiện tại. Chọn ngày trong quá khứ nếu anh đang nhập lại dữ liệu cũ.</p>
                    <div className="w-full md:w-1/2">
                      <CustomDatePicker
                        name="effective_date"
                        selected={effectiveDate}
                        onChange={(date) => setEffectiveDate(date)}
                        placeholderText="dd/mm/yyyy hh:mm:ss"
                      />
                    </div>
                  </div>
                </div>

                {isEdit && (
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1">Trạng thái</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring"
                    >
                      <option value="ACTIVE">Đang sử dụng (ACTIVE)</option>
                      <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
                    </select>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-text-primary">Thành phần 1 Mẻ nấu</h3>
                  </div>

                  <div className="space-y-3">
                    {ingredients.map((ing, index) => (
                      <div key={index} className="flex gap-2 items-center bg-page p-3 rounded-lg border border-border relative">
                        <button 
                          type="button" 
                          onClick={() => removeIngredient(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-danger rounded-full flex items-center justify-center text-xs hover:bg-red-200"
                        >
                          ✕
                        </button>
                        
                        <div className="w-1/3">
                          <select
                            value={ing.ingredient_type}
                            onChange={(e) => updateIngredient(index, "ingredient_type", e.target.value)}
                            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-card"
                          >
                            <option value="BASE_INGREDIENT">Nguyên liệu gốc</option>
                            <option value="SEMI_PRODUCT">Bán thành phẩm</option>
                          </select>
                        </div>

                        <div className="flex-1">
                          <SearchableSelect
                            required
                            value={ing.ingredient_id}
                            onChange={(val) => updateIngredient(index, "ingredient_id", val)}
                            options={
                              ing.ingredient_type === "BASE_INGREDIENT"
                                ? baseIngredients.map((b: any) => ({ id: b.id, label: b.name }))
                                : semiProducts.filter((s: any) => s.id !== initialData?.id).map((s: any) => ({ id: s.id, label: s.name }))
                            }
                            placeholder="-- Chọn thành phần --"
                          />
                        </div>

                        <div className="w-1/4 relative">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={ing.quantity}
                            onChange={(e) => updateIngredient(index, "quantity", e.target.value)}
                            className="w-full border border-border rounded-lg pl-3 pr-12 py-2 text-sm"
                            placeholder="Số lượng"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-text-secondary">
                            {getIngredientBaseUnit(ing) || "?"}
                          </span>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={addIngredient}
                      className="w-full py-2.5 border-2 border-dashed border-indigo-200 text-primary rounded-lg text-sm font-medium hover:bg-primary-soft transition mb-2"
                    >
                      + Thêm thành phần
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="p-6 border-t border-border bg-page flex justify-end gap-3 mt-auto">
              <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-text-secondary font-medium hover:bg-border rounded-lg transition">Huỷ</button>
              <button type="submit" form="semiProductForm" disabled={loading} className="px-5 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 transition shadow-sm">
                {loading ? "Đang lưu..." : "Lưu Bán Thành Phẩm"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
