"use client";

import { useState } from "react";
import { saveModifierAction as saveModifier, deleteModifierAction as deleteModifier } from "@/app/admin/products/modifiers/actions";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { alert, confirm } from "@/lib/dialog";

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
    if (!name || !groupName) return await alert({ title: "Thiếu thông tin", message: "Vui lòng nhập tên và chọn nhóm tuỳ chọn.", variant: "warning" });
    
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
      await alert({ title: "Lỗi", message: "Lỗi: " + res.error, variant: "danger" });
    }
  };

  const handleDelete = async () => {
    if (await confirm({ title: "Xác nhận xóa", message: `Bạn có chắc muốn xoá ${initialData.name}?`, variant: "danger" })) {
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
          className="px-4 py-2 bg-warning text-white rounded-lg text-sm font-medium hover:bg-warning/90 transition shadow-sm"
        >
          + Thêm Tuỳ chọn
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setIsOpen(true)} className="text-sm font-medium text-primary hover:text-primary-hover">Sửa</button>
          <button onClick={handleDelete} className="text-sm font-medium text-danger hover:text-danger">Xoá</button>
        </div>
      )}

      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface-card rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex justify-between items-center bg-page/50">
              <h2 className="text-xl font-bold text-text-primary">
                {isEdit ? "Sửa Tuỳ chọn" : "Thêm Tuỳ chọn mới"}
              </h2>
              <button onClick={() => setIsOpen(false)} className="text-text-muted hover:text-text-secondary" aria-label="Đóng">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <form id={isEdit ? `editMod-${initialData.id}` : "addMod"} onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-text-primary mb-1">Nhóm tuỳ chọn</label>
                    <select required value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring">
                      <option value="Thêm Topping">Thêm Topping</option>
                      <option value="Mức Đường">Mức Đường (Ghi chú)</option>
                      <option value="Mức Đá">Mức Đá (Ghi chú)</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-text-primary mb-1">Giá bán thêm (Nếu có)</label>
                    <input type="number" min="0" required value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-text-primary mb-1">Tên Tuỳ chọn (VD: Trân châu trắng, 50% Đường)</label>
                  <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full border border-border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-focus-ring" placeholder="Nhập tên..." />
                </div>

                <div className="border border-border rounded-lg p-4 bg-page/50">
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-sm font-bold text-text-primary">Định mức trừ kho (Cho Topping)</label>
                    <button type="button" onClick={addIngredient} className="text-xs font-bold text-primary bg-primary-soft px-2 py-1 rounded hover:bg-primary-soft">+ Thêm nguyên liệu</button>
                  </div>
                  
                  {ingredients.length === 0 ? (
                    <div className="text-xs text-text-secondary italic">Không cấu hình trừ kho (Dành cho Mức đường/đá).</div>
                  ) : (
                    <div className="space-y-2">
                      {ingredients.map((ing:any, iIdx:number) => (
                        <div key={iIdx} className="flex gap-2 items-center">
                          <select
                            aria-label="Loại nguyên liệu"
                            value={ing.ingredient_type}
                            onChange={e => { updateIngredient(iIdx, "ingredient_type", e.target.value); updateIngredient(iIdx, "ingredient_id", ""); }}
                            className="w-1/3 text-sm border border-border rounded-md px-2 py-1.5 bg-surface-card"
                          >
                            <option value="BASE_INGREDIENT">Nguyên liệu</option>
                            <option value="SEMI_PRODUCT">Bán thành phẩm</option>
                          </select>

                          <select
                            aria-label="Nguyên liệu"
                            required
                            value={ing.ingredient_id}
                            onChange={e => updateIngredient(iIdx, "ingredient_id", e.target.value)}
                            className="flex-1 text-sm border border-border rounded-md px-2 py-1.5 bg-surface-card"
                          >
                            <option value="">- Chọn -</option>
                            {ing.ingredient_type === "BASE_INGREDIENT" 
                              ? baseIngredients.map((b:any) => <option key={b.id} value={b.id}>{b.name} ({units.find((u:any) => u.id === b.base_unit)?.name})</option>)
                              : semiProducts.map((s:any) => <option key={s.id} value={s.id}>{s.name} ({units.find((u:any) => u.id === s.base_unit)?.name})</option>)
                            }
                          </select>

                          <input
                            aria-label="Số lượng nguyên liệu"
                            type="number" required min="0.001" step="any" placeholder="SL"
                            value={ing.quantity || ""}
                            onChange={e => updateIngredient(iIdx, "quantity", Number(e.target.value))}
                            className="w-20 text-sm text-right font-bold text-danger border border-border rounded-md px-2 py-1.5"
                          />
                          
                          <button type="button" aria-label="Xoá nguyên liệu định lượng" onClick={() => removeIngredient(iIdx)} className="p-1.5 text-text-muted hover:text-danger">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </div>

            <div className="p-5 border-t border-border bg-page flex justify-end gap-3 mt-auto">
              <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-text-secondary font-medium hover:bg-border rounded-lg transition">Huỷ</button>
              <button type="submit" form={isEdit ? `editMod-${initialData.id}` : "addMod"} disabled={loading} className="px-5 py-2.5 bg-warning text-white font-bold rounded-lg hover:bg-warning/90 disabled:opacity-50">
                {loading ? "Đang lưu..." : "Lưu Tuỳ Chọn"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}
