"use client";

import { useState, useId } from "react";
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
  const formId = useId();
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
          className="text-primary hover:text-primary-hover font-medium text-sm mr-4"
        >
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-button font-medium hover:bg-primary-hover transition transition"
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
              className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg font-medium"
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
            <div role="alert" aria-live="polite" className="p-3 bg-danger/10 text-danger text-sm rounded-lg border border-danger/20">
              {error}
            </div>
          )}
          
          <div className="space-y-3">
            {items.map((item, idx) => {
              const itemRowId = `${formId}-item-${idx}`;
              return (
                <div key={idx} className="flex gap-3 items-end bg-surface-secondary p-3 rounded-xl border border-border relative">
                  <div className="flex-1">
                    <label htmlFor={`${itemRowId}-name`} className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Tên Nguyên Liệu</label>
                    <input
                      id={`${itemRowId}-name`}
                      type="text"
                      required
                      value={item.name}
                      onChange={(e) => updateItem(idx, { name: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-focus-ring text-text-primary"
                      placeholder="VD: Cà phê bột"
                    />
                  </div>
                  <div className="w-40">
                    <label htmlFor={`${itemRowId}-base_unit`} className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Đơn vị cơ bản</label>
                    <SearchableSelect
                      id={`${itemRowId}-base_unit`}
                      options={unitOptions}
                      value={item.base_unit}
                      onChange={(val) => updateItem(idx, { base_unit: val })}
                      placeholder="Chọn đơn vị..."
                      className="text-sm"
                    />
                  </div>
                  <div className="flex flex-col items-center pb-2">
                    <label htmlFor={`${itemRowId}-non_inventory`} className="block text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1">Phi lưu kho</label>
                    <input
                      id={`${itemRowId}-non_inventory`}
                      type="checkbox"
                      checked={item.is_non_inventory}
                      onChange={(e) => updateItem(idx, { is_non_inventory: e.target.checked })}
                      className="w-5 h-5 rounded border-border text-primary focus:ring-focus-ring"
                    />
                  </div>
                  {!isEdit && items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItemRow(idx)}
                      className="p-2 text-text-muted hover:text-danger transition"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {!isEdit && (
            <button
              type="button"
              onClick={addItemRow}
              className="w-full py-2 border-2 border-dashed border-border rounded-xl text-text-muted text-sm font-medium hover:border-primary/40 hover:text-primary transition"
            >
              + Thêm dòng mới
            </button>
          )}
        </form>
      </FormModal>
    </>
  );
}
