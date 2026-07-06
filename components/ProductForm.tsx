"use client";

import { useState, useId } from "react";
import { saveProduct, deleteProduct } from "@/app/admin/products/actions";
import { SearchableSelect } from "./SearchableSelect";
import { CustomDatePicker } from "./CustomDatePicker";
import { ModalPortal } from "@/components/ui/ModalPortal";

export default function ProductForm({ categories, baseIngredients, semiProducts, units, initialData }: any) {
  const isEdit = !!initialData;
  const formId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [categoryId, setCategoryId] = useState(initialData?.category_id || "");
  const [name, setName] = useState(initialData?.name || "");

  // variants format: { id?: string, size_name: string, price: number, ingredients: { ingredient_id: string, ingredient_type: string, quantity: number }[] }
  const [variants, setVariants] = useState<any[]>(
    initialData?.variants || [{ size_name: "Mặc định", price: 0, ingredients: [] }]
  );
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(initialData?.effective_date ? new Date(initialData.effective_date) : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !categoryId) return alert("Vui lòng nhập Tên món và chọn Nhóm.");
    if (variants.length === 0) return alert("Phải có ít nhất 1 kích cỡ/size.");

    setLoading(true);
    const formData = new FormData();
    if (isEdit) formData.append("id", initialData.id);
    formData.append("category_id", categoryId);
    formData.append("name", name);
    formData.append("variants_json", JSON.stringify(variants));
    
    const effectiveDateStr = effectiveDate ? effectiveDate.toISOString() : "";
    formData.append("effective_date", effectiveDateStr);

    const res = await saveProduct(formData);
    setLoading(false);

    if (res.success) {
      setIsOpen(false);
      if (!isEdit) {
        setName("");
        setCategoryId("");
        setVariants([{ size_name: "Mặc định", price: 0, ingredients: [] }]);
      }
    } else {
      alert("Lỗi: " + res.error);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    const formData = new FormData();
    formData.append("id", initialData.id);
    const res = await deleteProduct(formData);
    setLoading(false);
    if (res?.error) {
      alert("Lỗi: " + res.error);
    } else {
      setIsDeleteOpen(false);
    }
  };

  // --- HANDLERS FOR VARIANTS ---
  const addVariant = () => {
    setVariants([...variants, { size_name: "", price: 0, ingredients: [] }]);
  };
  const updateVariant = (vIndex: number, field: string, value: any) => {
    const newVars = [...variants];
    newVars[vIndex][field] = value;
    setVariants(newVars);
  };
  const removeVariant = (vIndex: number) => {
    setVariants(variants.filter((_, i) => i !== vIndex));
  };

  // --- HANDLERS FOR INGREDIENTS INSIDE VARIANT ---
  const addIngredient = (vIndex: number) => {
    const newVars = [...variants];
    newVars[vIndex].ingredients.push({ ingredient_id: "", ingredient_type: "BASE_INGREDIENT", quantity: 0 });
    setVariants(newVars);
  };
  const updateIngredient = (vIndex: number, iIndex: number, field: string, value: any) => {
    const newVars = [...variants];
    newVars[vIndex].ingredients[iIndex][field] = value;
    setVariants(newVars);
  };
  const removeIngredient = (vIndex: number, iIndex: number) => {
    const newVars = [...variants];
    newVars[vIndex].ingredients = newVars[vIndex].ingredients.filter((_:any, idx:number) => idx !== iIndex);
    setVariants(newVars);
  };

  const calculateVariantCost = (variant: any) => {
    let cost = 0;
    for (const ing of variant.ingredients) {
      if (!ing.ingredient_id) continue;
      let mac = 0;
      if (ing.ingredient_type === "BASE_INGREDIENT") {
        mac = baseIngredients.find((b: any) => b.id === ing.ingredient_id)?.current_mac || 0;
      } else {
        mac = semiProducts.find((s: any) => s.id === ing.ingredient_id)?.current_mac || 0;
      }
      cost += mac * (ing.quantity || 0);
    }
    return cost;
  };

  return (
    <>
      {!isEdit ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 transition shadow-sm"
        >
          + Thêm Món Mới
        </button>
      ) : (
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => setIsOpen(true)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Sửa</button>
          <button type="button" onClick={() => setIsDeleteOpen(true)} className="text-sm font-medium text-red-600 hover:text-red-800">Xoá</button>
        </div>
      )}

      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800">
                {isEdit ? "Sửa Món" : "Tạo Món Mới (Product Builder)"}
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-gray-50/30">
              <form id={isEdit ? `editProd-${initialData.id}` : "addProd"} onSubmit={handleSubmit} className="space-y-6 pb-48">
                
                {/* THÔNG TIN CHUNG */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="bg-orange-100 text-orange-600 w-6 h-6 rounded-full flex items-center justify-center text-sm">1</span>
                    Thông Tin Cơ Bản
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor={`${formId}-name`} className="block text-sm font-bold text-gray-700 mb-1">Tên món *</label>
                      <input id={`${formId}-name`} type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-orange-500" placeholder="VD: Cà phê sữa đá..." />
                    </div>
                    <div>
                      <label htmlFor={`${formId}-category-id`} className="block text-sm font-bold text-gray-700 mb-1">Nhóm món *</label>
                      <select id={`${formId}-category-id`} required value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-orange-500 bg-white">
                        <option value="">-- Chọn nhóm --</option>
                        {categories.map((c:any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <label htmlFor={`${formId}-effective-date`} className="block text-sm font-bold text-gray-800 mb-1">Ngày áp dụng giá & công thức (Tuỳ chọn)</label>
                    <p className="text-xs text-gray-500 mb-2">Bỏ trống hệ thống sẽ lấy thời gian hiện tại. Dành cho việc cập nhật lịch sử bán hàng cũ.</p>
                    <div className="w-full md:w-1/2">
                      <CustomDatePicker
                        id={`${formId}-effective-date`}
                        name="effective_date"
                        selected={effectiveDate}
                        onChange={(date) => setEffectiveDate(date)}
                        placeholderText="dd/mm/yyyy hh:mm:ss"
                      />
                    </div>
                  </div>
                </div>

                {/* VARIANTS & RECIPES */}
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                      <span className="bg-orange-100 text-orange-600 w-6 h-6 rounded-full flex items-center justify-center text-sm">2</span>
                      Các Kích Cỡ & Công Thức
                    </h3>
                    <button type="button" onClick={addVariant} className="text-sm font-medium text-orange-600 bg-orange-50 px-3 py-1.5 rounded-lg hover:bg-orange-100">+ Thêm Size</button>
                  </div>

                  <div className="space-y-6">
                    {variants.map((variant, vIdx) => {
                      const variantRowId = `${formId}-variant-${vIdx}`;
                      return (
                        <div key={vIdx} className="border border-gray-200 rounded-xl overflow-visible">
                          <div className="bg-gray-100 p-4 border-b border-gray-200 flex gap-4 items-end rounded-t-xl">
                            <div className="flex-1">
                              <label htmlFor={`${variantRowId}-size-name`} className="block text-xs font-bold text-gray-600 uppercase mb-1">Tên Kích cỡ (Size)</label>
                              <input id={`${variantRowId}-size-name`} type="text" required value={variant.size_name} onChange={e => updateVariant(vIdx, "size_name", e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-bold focus:ring-orange-500" placeholder="VD: Mặc định, Size M..." />
                            </div>
                            <div className="flex-1">
                              <label htmlFor={`${variantRowId}-price`} className="block text-xs font-bold text-gray-600 uppercase mb-1">Giá bán (VNĐ)</label>
                              <input id={`${variantRowId}-price`} type="number" required min="0" value={variant.price} onChange={e => updateVariant(vIdx, "price", e.target.value === "" ? "" : e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-bold text-indigo-700 focus:ring-orange-500" />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Giá vốn dự kiến (VNĐ)</label>
                              <div className="w-full border border-transparent px-3 py-2 text-sm font-bold text-gray-500 bg-white rounded-md shadow-sm">
                                {Math.round(calculateVariantCost(variant)).toLocaleString()}đ
                              </div>
                            </div>
                            {variants.length > 1 && (
                              <button type="button" onClick={() => removeVariant(vIdx)} className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-md text-sm font-medium">Xoá Size</button>
                            )}
                          </div>
                          
                          <div className="p-4 bg-white">
                            <div className="flex justify-between items-center mb-3">
                              <label className="text-sm font-bold text-gray-700">Công thức định lượng (Sẽ trừ kho)</label>
                              <button type="button" onClick={() => addIngredient(vIdx)} className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100">+ Thêm Nguyên Liệu</button>
                            </div>
                            
                            {variant.ingredients.length === 0 ? (
                              <div className="text-xs text-gray-400 italic text-center py-4 border border-dashed border-gray-200 rounded-lg">Chưa có thành phần công thức nào.</div>
                            ) : (
                              <div className="space-y-2">
                                {variant.ingredients.map((ing:any, iIdx:number) => (
                                  <div key={iIdx} className="flex gap-2 items-center">
                                    <select
                                      value={ing.ingredient_type}
                                      onChange={e => {
                                        updateIngredient(vIdx, iIdx, "ingredient_type", e.target.value);
                                        updateIngredient(vIdx, iIdx, "ingredient_id", "");
                                      }}
                                      className="w-1/4 text-sm border border-gray-300 rounded-md px-2 py-2 focus:ring-orange-500 bg-gray-50"
                                    >
                                      <option value="BASE_INGREDIENT">Nguyên liệu / Vật tư</option>
                                      <option value="SEMI_PRODUCT">Bán thành phẩm</option>
                                    </select>
  
                                    <div className="flex-1">
                                      <SearchableSelect
                                        required
                                        value={ing.ingredient_id}
                                        onChange={(val) => updateIngredient(vIdx, iIdx, "ingredient_id", val)}
                                        options={
                                          ing.ingredient_type === "BASE_INGREDIENT"
                                            ? baseIngredients.map((b: any) => ({ id: b.id, label: `${b.name} (Tồn kho: ${units.find((u: any) => u.id === b.base_unit)?.name || b.base_unit})` }))
                                            : semiProducts.map((s: any) => ({ id: s.id, label: `${s.name} (Tồn kho: ${units.find((u: any) => u.id === s.base_unit)?.name || s.base_unit})` }))
                                        }
                                        placeholder="- Chọn -"
                                      />
                                    </div>
  
                                    <input
                                      type="number"
                                      required
                                      min="0.001"
                                      step="any"
                                      placeholder="SL"
                                      value={ing.quantity || ""}
                                      onChange={e => updateIngredient(vIdx, iIdx, "quantity", Number(e.target.value))}
                                      className="w-20 text-sm text-right font-bold text-red-600 border border-gray-300 rounded-md px-2 py-2 focus:ring-orange-500"
                                    />
                                    
                                    <button type="button" onClick={() => removeIngredient(vIdx, iIdx)} className="p-1.5 text-gray-400 hover:text-red-500 rounded-md">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* End of form */}

              </form>
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 mt-auto">
              <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">Huỷ</button>
              <button 
                type="submit" 
                form={isEdit ? `editProd-${initialData.id}` : "addProd"} 
                disabled={loading} 
                className="px-5 py-2.5 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? "Đang xử lý..." : "Lưu Menu"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {isDeleteOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center gap-3 bg-red-50/50">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-800">
                Xác nhận xoá
              </h2>
            </div>
            <div className="p-5">
              <p className="text-gray-600 text-sm text-left">
                Bạn có chắc chắn muốn xoá món <span className="font-bold text-gray-900">{initialData.name}</span> không?<br/>
                Thao tác này không thể hoàn tác.
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsDeleteOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">
                Huỷ
              </button>
              <button 
                type="button" 
                onClick={handleDelete} 
                disabled={loading} 
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? "Đang xử lý..." : "Xoá Món"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
