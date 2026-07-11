"use client";

import { useState, useId } from "react";
import { formatNumber } from "@/lib/format";

interface IngredientOption {
  id: string;
  name: string;
  unit: string;
  current_mac: number;
  type: "BASE_INGREDIENT" | "SEMI_PRODUCT";
}

export default function CogsCalculator({ ingredients }: { ingredients: IngredientOption[] }) {
  const formId = useId();
  const [items, setItems] = useState<any[]>([]);

  const addItem = (isCustom: boolean) => {
    setItems([...items, {
      id: Date.now().toString(),
      isCustom,
      ingredient_id: "",
      custom_name: "",
      unit: "",
      quantity: 1,
      unit_cost: 0
    }]);
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    const item = newItems[index];
    
    if (field === "ingredient_id" && !item.isCustom) {
      const selected = ingredients.find(i => i.id === value);
      if (selected) {
        item.ingredient_id = value;
        item.unit_cost = selected.current_mac;
        item.unit = selected.unit;
      } else {
        item.ingredient_id = "";
        item.unit_cost = 0;
        item.unit = "";
      }
    } else {
      item[field] = value;
    }
    
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalCost = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_cost || 0)), 0);

  return (
    <div className="bg-surface-card p-6 rounded-xl shadow-sm border border-border max-w-4xl mx-auto">
      <div className="space-y-4 mb-6">
        {items.map((item, idx) => {
          const itemRowId = `${formId}-item-${idx}`;
          return (
            <div key={item.id} className="flex flex-col md:flex-row gap-3 items-end bg-surface-secondary p-4 rounded-lg border border-border">
              <div className="w-full md:w-1/3">
                <label htmlFor={`${itemRowId}-ingredient`} className="block text-xs font-bold text-text-secondary uppercase mb-1">
                  {item.isCustom ? "Tên nguyên liệu (Nhập tay)" : "Nguyên liệu hệ thống"}
                </label>
                {item.isCustom ? (
                  <input 
                    id={`${itemRowId}-ingredient`}
                    type="text" 
                    value={item.custom_name} 
                    onChange={e => updateItem(idx, "custom_name", e.target.value)} 
                    placeholder="VD: Trà ô long mới..."
                    className="w-full border border-border rounded-md px-3 py-2 min-h-[44px] text-sm focus:ring-orange-500"
                  />
                ) : (
                  <select 
                    id={`${itemRowId}-ingredient`}
                    value={item.ingredient_id} 
                    onChange={e => updateItem(idx, "ingredient_id", e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 min-h-[44px] text-sm focus:ring-orange-500"
                  >
                    <option value="">-- Chọn nguyên liệu --</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} (Kho: {ing.unit})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="w-full md:w-24">
                <label htmlFor={item.isCustom ? `${itemRowId}-unit` : undefined} className="block text-xs font-bold text-text-secondary uppercase mb-1">Đơn vị</label>
                {item.isCustom ? (
                  <input 
                    id={`${itemRowId}-unit`}
                    type="text" 
                    value={item.unit} 
                    onChange={e => updateItem(idx, "unit", e.target.value)} 
                    placeholder="VD: kg"
                    className="w-full border border-border rounded-md px-3 py-2 min-h-[44px] text-sm focus:ring-orange-500"
                  />
                ) : (
                  <div className="w-full border border-border bg-surface-secondary rounded-md px-3 py-2 min-h-[44px] flex items-center text-sm text-text-muted font-medium">
                    {item.unit || "-"}
                  </div>
                )}
              </div>

              <div className="w-full md:w-32">
                <label htmlFor={`${itemRowId}-unitCost`} className="block text-xs font-bold text-text-secondary uppercase mb-1">Đơn giá vốn</label>
                <div className="relative">
                    <input 
                      id={`${itemRowId}-unitCost`}
                      type="number" 
                      min="0"
                      value={item.unit_cost === 0 ? "" : item.unit_cost} 
                      onChange={e => updateItem(idx, "unit_cost", Number(e.target.value))} 
                      disabled={!item.isCustom}
                      placeholder="0"
                      className={`w-full border border-border rounded-md px-3 py-2 min-h-[44px] text-sm font-bold focus:ring-orange-500 ${!item.isCustom ? "bg-surface-secondary text-text-muted" : "text-indigo-700"}`}
                    />
                </div>
              </div>

              <div className="w-full md:w-24">
                <label htmlFor={`${itemRowId}-quantity`} className="block text-xs font-bold text-text-secondary uppercase mb-1">Định lượng</label>
                <input 
                  id={`${itemRowId}-quantity`}
                  type="number" 
                  min="0"
                  step="any"
                  value={item.quantity === 0 ? "" : item.quantity} 
                  onChange={e => updateItem(idx, "quantity", Number(e.target.value))} 
                  className="w-full border border-border rounded-md px-3 py-2 min-h-[44px] text-sm font-bold text-danger focus:ring-orange-500"
                />
              </div>

              <div className="w-full md:w-32">
                <label className="block text-xs font-bold text-text-secondary uppercase mb-1">Thành tiền</label>
                <div className="w-full border border-transparent bg-warning/10 rounded-md px-3 py-2 min-h-[44px] flex items-center justify-end text-sm font-bold text-warning-active text-right">
                  {formatNumber(Math.round((item.quantity || 0) * (item.unit_cost || 0)))}
                </div>
              </div>

              <button 
                onClick={() => removeItem(idx)}
                className="px-3 py-2 min-h-[44px] text-text-muted hover:bg-danger/20 hover:text-danger rounded-md transition-colors"
                title="Xoá dòng"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
            <p className="text-text-muted mb-4">Chưa có nguyên liệu nào trong công thức giả lập.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <button 
          onClick={() => addItem(false)}
          className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 transition-colors text-sm"
        >
          <span>+</span> Thêm NL Hệ thống
        </button>
        <button 
          onClick={() => addItem(true)}
          className="flex items-center gap-2 px-4 py-2 min-h-[44px] bg-surface-secondary text-text-secondary font-medium rounded-lg hover:border-border transition-colors text-sm"
        >
          <span>+</span> Thêm NL Tự nhập
        </button>
      </div>

      <div className="border-t border-border pt-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-text-secondary">
            Tổng cộng: <span className="font-bold text-text-primary">{items.length}</span> thành phần
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-4">
              <span className="text-lg font-medium text-text-secondary">Tổng Giá Vốn:</span>
              <span className="text-3xl font-black text-warning">{formatNumber(Math.round(totalCost))}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-text-muted">Giá bán dự kiến (COGS 40%):</span>
              <span className="text-xl font-bold text-indigo-600">{formatNumber(Math.round(totalCost / 0.4))}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
