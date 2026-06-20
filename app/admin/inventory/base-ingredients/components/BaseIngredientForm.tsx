"use client";

import { useState } from "react";
import { addBaseIngredient, updateBaseIngredient } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { DBBaseIngredient, DBUnit } from "@/types/db";

interface BaseIngredientFormProps {
  initialData?: DBBaseIngredient;
  units: DBUnit[];
}

export function BaseIngredientForm({ initialData, units }: BaseIngredientFormProps) {
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialUnitName = initialData 
    ? units.find(u => u.id === initialData.base_unit)?.name || "" 
    : "";

  const [items, setItems] = useState<Array<{ name: string; base_unit: string; is_non_inventory: boolean }>>(
    isEdit 
      ? [{ name: initialData!.name, base_unit: initialUnitName, is_non_inventory: initialData!.is_non_inventory === "TRUE" }]
      : [{ name: "", base_unit: "", is_non_inventory: false }]
  );

  const unitOptions = units.map(u => ({ id: u.name, label: u.name }));

  function addItemRow() {
    setItems([...items, { name: "", base_unit: "", is_non_inventory: false }]);
  }

  function removeItemRow(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, fields: Partial<{ name: string; base_unit: string; is_non_inventory: boolean }>) {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...fields };
    setItems(newItems);
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const processedItems = [...items];
    for (let i = 0; i < processedItems.length; i++) {
      const item = processedItems[i];
      if (!item.name || !item.base_unit) {
        if (!isEdit) continue; // Skip empty rows in add mode
        setError("Vui lòng điền đầy đủ tên và đơn vị");
        setLoading(false);
        return;
      }

      const unitObj = units.find(u => u.name.toLowerCase() === item.base_unit.toLowerCase());
      if (!unitObj) {
        setError(`Đơn vị "${item.base_unit}" không hợp lệ ở dòng ${i + 1}`);
        setLoading(false);
        return;
      }
      processedItems[i] = { ...item, base_unit: unitObj.id };
    }

    if (isEdit) {
      const item = processedItems[0];
      formData.append("id", initialData!.id);
      formData.append("name", item.name);
      formData.append("base_unit", item.base_unit);
      formData.append("is_non_inventory", String(item.is_non_inventory));
      const res = await updateBaseIngredient(formData);
      if (res.error) setError(res.error);
      else setIsOpen(false);
    } else {
      formData.append("items_json", JSON.stringify(processedItems.filter(it => it.name && it.base_unit)));
      const res = await addBaseIngredient(formData);
      if (res.error) setError(res.error);
      else {
        setIsOpen(false);
        setItems([{ name: "", base_unit: "", is_non_inventory: false }]);
      }
    }
    setLoading(false);
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
          + Thêm Nguyên Liệu
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
          if (!isEdit) setItems([{ name: "", base_unit: "", is_non_inventory: false }]);
        }}
        title={isEdit ? "Sửa Nguyên Liệu" : "Thêm Nguyên Liệu Mới"}
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
              form="base-ingredient-form"
              loading={loading}
              loadingText="Đang lưu..."
            >
              {isEdit ? "Cập nhật" : "Lưu Nguyên Liệu"}
            </LoadingButton>
          </>
        }
      >
        <form id="base-ingredient-form" action={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}
          
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-end bg-gray-50 p-3 rounded-xl border border-gray-100 relative">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tên Nguyên Liệu</label>
                  <input
                    type="text"
                    required
                    value={item.name}
                    onChange={(e) => updateItem(idx, { name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-gray-900"
                    placeholder="VD: Cà phê bột"
                  />
                </div>
                <div className="w-40">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Đơn vị cơ bản</label>
                  <SearchableSelect
                    options={unitOptions}
                    value={item.base_unit}
                    onChange={(val) => updateItem(idx, { base_unit: val })}
                    placeholder="Chọn đơn vị..."
                    className="text-sm"
                  />
                </div>
                <div className="flex flex-col items-center pb-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Phi lưu kho</label>
                  <input
                    type="checkbox"
                    checked={item.is_non_inventory}
                    onChange={(e) => updateItem(idx, { is_non_inventory: e.target.checked })}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
                {!isEdit && items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="p-2 text-gray-400 hover:text-red-500 transition"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {!isEdit && (
            <button
              type="button"
              onClick={addItemRow}
              className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 text-sm font-medium hover:border-blue-300 hover:text-blue-500 transition"
            >
              + Thêm dòng mới
            </button>
          )}
        </form>
      </FormModal>
    </>
  );
}
