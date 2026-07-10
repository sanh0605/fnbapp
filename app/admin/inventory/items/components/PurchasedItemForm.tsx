"use client";

import { useState, useId } from "react";
import { addPurchasedItem, updatePurchasedItem } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { DBPurchasedItem, DBUOMConversion, DBItemCategory, DBBaseIngredient, DBUnit } from "@/types/db";

interface PurchasedItemFormProps {
  itemCategories: DBItemCategory[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
  initialData?: DBPurchasedItem;
  initialConversions?: DBUOMConversion[];
}

export function PurchasedItemForm({ 
  itemCategories, 
  baseIngredients, 
  units, 
  initialData, 
  initialConversions 
}: PurchasedItemFormProps) {
  const formId = useId();
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCategoryId, setSelectedCategoryId] = useState(initialData?.item_category_id || "");
  const [selectedBaseIngredientId, setSelectedBaseIngredientId] = useState(initialData?.base_ingredient_id || "");

  const activeCategory = itemCategories.find(c => c.id === selectedCategoryId);
  const isRaw = activeCategory?.system_type === "RAW";

  const [unitsState, setUnitsState] = useState<Array<{ id?: string; name: string; conversion_rate: string }>>(
    initialConversions && initialConversions.length > 0
      ? initialConversions.map(c => {
          const pUnit = c.purchased_unit || "";
          // purchased_unit được lưu trong DB là unit ID (VD: "U001")
          // nhưng SearchableSelect dùng unit name làm value → cần convert
          const unitName = units.find(u => u.id === pUnit)?.name || pUnit;
          return { id: c.id, name: unitName, conversion_rate: c.conversion_rate || "" };
        })
      : [{ name: "", conversion_rate: "" }]
  );

  const [updateHistory, setUpdateHistory] = useState(true);

  const activeBaseIngredient = baseIngredients.find(b => b.id === selectedBaseIngredientId);
  const baseUnitId = activeBaseIngredient?.base_unit;
  const baseUnitName = baseUnitId ? units.find(u => u.id === baseUnitId)?.name : "";

  function addUnitRow() {
    setUnitsState([...unitsState, { name: "", conversion_rate: "" }]);
  }

  function updateUnitRow(index: number, field: "name" | "conversion_rate", value: string) {
    const newUnits = [...unitsState];
    newUnits[index][field] = value;
    setUnitsState(newUnits);
  }

  function removeUnitRow(index: number) {
    if (unitsState.length <= 1) return;
    setUnitsState(unitsState.filter((_, i) => i !== index));
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const name = formData.get("name") as string;
    if (!name || !selectedCategoryId) {
      setError("Vui lòng nhập Tên và chọn Phân loại");
      setLoading(false);
      return;
    }

    if (isRaw) {
      if (!selectedBaseIngredientId) {
        setError("Nguyên liệu thô cần được liên kết với một Nhóm Nguyên Liệu");
        setLoading(false);
        return;
      }
      
      const processedUnits = [...unitsState];
      for (let i = 0; i < processedUnits.length; i++) {
        const u = processedUnits[i];
        if (!u.name || !u.conversion_rate) {
          setError(`Vui lòng nhập đủ thông tin Quy đổi (dòng ${i + 1})`);
          setLoading(false);
          return;
        }
        
        // Resolve unit name to ID
        const unitObj = units.find(unit => unit.name.toLowerCase() === u.name.toLowerCase());
        if (!unitObj) {
          setError(`Đơn vị "${u.name}" không hợp lệ (dòng ${i + 1})`);
          setLoading(false);
          return;
        }
        processedUnits[i].name = unitObj.id;
      }
      
      formData.append("base_ingredient_id", selectedBaseIngredientId);
      formData.append("base_unit", baseUnitId || "");
      formData.append("units_json", JSON.stringify(processedUnits));
    }

    formData.append("item_category_id", selectedCategoryId);
    
    if (isEdit) {
      formData.append("id", initialData!.id);
      formData.append("update_history", String(updateHistory));
      const res = await updatePurchasedItem(formData);
      if (res.error) setError(res.error);
      else setIsOpen(false);
    } else {
      const res = await addPurchasedItem(formData);
      if (res.error) setError(res.error);
      else {
        setIsOpen(false);
        setSelectedCategoryId("");
        setSelectedBaseIngredientId("");
        setUnitsState([{ name: "", conversion_rate: "" }]);
      }
    }
    setLoading(false);
  }

  const categoryOptions = itemCategories.map(c => ({ id: c.id, label: c.name }));
  const baseIngredientOptions = baseIngredients.map(b => ({ id: b.id, label: b.name }));
  const unitOptions = units.map(u => ({ id: u.name, label: u.name }));

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
          + Thêm Hàng Mua Vào
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title={isEdit ? "Sửa Hàng Hóa Mua Vào" : "Thêm Hàng Hóa Mua Vào"}
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
              form="purchased-item-form"
              loading={loading}
              loadingText="Đang lưu..."
            >
              {isEdit ? "Cập nhật" : "Lưu"}
            </LoadingButton>
          </>
        }
      >
        <form id="purchased-item-form" action={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" aria-live="polite" className="p-3 bg-rose-50 text-rose-600 text-sm rounded-lg border border-rose-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${formId}-name`} className="block text-sm font-medium text-gray-700 mb-1">Tên Hàng Hóa</label>
              <input
                id={`${formId}-name`}
                type="text"
                name="name"
                required
                defaultValue={initialData?.name}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-gray-900"
                placeholder="VD: Cà phê hạt Robusta 500g"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-categoryId`} className="block text-sm font-medium text-gray-700 mb-1">Phân Loại</label>
              <select
                id={`${formId}-categoryId`}
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-blue-500 bg-white"
                required
              >
                <option value="">Chọn phân loại...</option>
                {itemCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {isRaw && (
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <div className="p-3 bg-blue-50 text-blue-800 text-sm rounded-lg border border-blue-100">
                Đây là nhóm <strong>Hàng Hóa Chế Biến (RAW)</strong>. Hàng mua vào phải được liên kết với một Nhóm Nguyên Liệu để hệ thống biết cách lưu kho và quản lý định lượng.
              </div>

              <div>
                <label htmlFor={`${formId}-baseIngredientId`} className="block text-sm font-medium text-gray-700 mb-1">Liên kết Nhóm Nguyên Liệu</label>
                <SearchableSelect
                  id={`${formId}-baseIngredientId`}
                  options={baseIngredientOptions}
                  value={selectedBaseIngredientId}
                  onChange={setSelectedBaseIngredientId}
                  placeholder="Tìm nhóm nguyên liệu..."
                />
              </div>

              {selectedBaseIngredientId && (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-sm font-bold text-gray-900">Quy đổi đơn vị mua</h4>
                    <button
                      type="button"
                      onClick={addUnitRow}
                      className="text-xs font-bold text-blue-600 hover:text-blue-800"
                    >
                      + Thêm đơn vị mua
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {unitsState.map((u, idx) => {
                      const unitRowId = `${formId}-unit-${idx}`;
                      return (
                        <div key={idx} className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label htmlFor={`${unitRowId}-name`} className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Đơn vị mua</label>
                            <SearchableSelect
                              id={`${unitRowId}-name`}
                              options={unitOptions}
                              value={u.name}
                              onChange={(val) => updateUnitRow(idx, "name", val)}
                              placeholder="VD: Bao 10kg"
                            />
                          </div>
                          <div className="px-2 pb-2 text-gray-400 font-bold">=</div>
                          <div className="w-24 relative">
                            <label htmlFor={`${unitRowId}-conversion_rate`} className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Hệ số</label>
                            <input
                              id={`${unitRowId}-conversion_rate`}
                              type="number"
                              step="any"
                              value={u.conversion_rate}
                              onChange={(e) => updateUnitRow(idx, "conversion_rate", e.target.value)}
                              className="w-full border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="px-2 pb-2 text-sm text-gray-600 font-medium">
                            {baseUnitName || "cơ bản"}
                          </div>
                          {unitsState.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeUnitRow(idx)}
                              className="pb-2 px-2 text-gray-400 hover:text-rose-500"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {isEdit && (
                    <div className="mt-4 flex items-start gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
                      <input
                        type="checkbox"
                        id={`${formId}-update_history`}
                        checked={updateHistory}
                        onChange={(e) => setUpdateHistory(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <label htmlFor={`${formId}-update_history`} className="text-xs text-orange-800 leading-tight">
                        Cập nhật lại đơn vị mua cho các đơn đặt hàng cũ của mặt hàng này nếu đơn vị mua bị thay đổi.
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
      </FormModal>
    </>
  );
}
