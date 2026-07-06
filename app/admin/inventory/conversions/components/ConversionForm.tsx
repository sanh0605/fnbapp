"use client";

import { useState, useMemo, useId } from "react";
import { addConversion, updateConversion } from "../actions";
import { FormModal } from "@/components/ui/FormModal";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { SearchableSelect } from "@/components/SearchableSelect";
import type { DBPurchasedItem, DBBaseIngredient, DBUnit, DBUOMConversion } from "@/types/db";

interface ConversionFormProps {
  items: DBPurchasedItem[];
  baseIngredients: DBBaseIngredient[];
  units: DBUnit[];
  initialData?: DBUOMConversion;
}

export function ConversionForm({ items, baseIngredients, units, initialData }: ConversionFormProps) {
  const formId = useId();
  const isEdit = !!initialData;
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedItemId, setSelectedItemId] = useState(initialData?.purchased_item_id || "");
  const [selectedUnitName, setSelectedUnitName] = useState(
    initialData ? units.find(u => u.id === initialData.purchased_unit)?.name || "" : ""
  );
  const [conversionRate, setConversionRate] = useState(initialData?.conversion_rate || "");
  const [updateHistory, setUpdateHistory] = useState(true);

  const itemOptions = items.map(item => ({ id: item.id, label: item.name }));
  const unitOptions = units.map(u => ({ id: u.name, label: u.name }));

  const selectedItem = useMemo(() => 
    items.find(i => i.id === selectedItemId), 
    [items, selectedItemId]
  );

  const baseIngredient = useMemo(() => 
    selectedItem ? baseIngredients.find(bi => bi.id === selectedItem.base_ingredient_id) : null,
    [baseIngredients, selectedItem]
  );

  const baseUnit = useMemo(() => 
    baseIngredient ? units.find(u => u.id === baseIngredient.base_unit) : null,
    [units, baseIngredient]
  );

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    if (!selectedItemId || !selectedUnitName || !conversionRate || !baseUnit) {
      setError("Vui lòng điền đầy đủ thông tin");
      setLoading(false);
      return;
    }

    const unitObj = units.find(u => u.name.toLowerCase() === selectedUnitName.toLowerCase());
    if (!unitObj) {
      setError("Đơn vị mua không hợp lệ");
      setLoading(false);
      return;
    }

    formData.append("purchased_item_id", selectedItemId);
    formData.append("purchased_unit", unitObj.id);
    formData.append("conversion_rate", conversionRate);
    formData.append("base_unit", baseUnit.id);

    if (isEdit) {
      formData.append("id", initialData!.id);
      formData.append("update_history", String(updateHistory));
      const res = await updateConversion(formData);
      if (res.error) setError(res.error);
      else setIsOpen(false);
    } else {
      const res = await addConversion(formData);
      if (res.error) setError(res.error);
      else {
        setIsOpen(false);
        setSelectedItemId("");
        setSelectedUnitName("");
        setConversionRate("");
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
          + Thêm Quy Đổi
        </button>
      )}

      <FormModal
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setError(null);
        }}
        title={isEdit ? "Sửa Quy Đổi" : "Thêm Quy Đổi Mới"}
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
              form="conversion-form"
              loading={loading}
              loadingText="Đang lưu..."
            >
              {isEdit ? "Cập nhật" : "Lưu Quy Đổi"}
            </LoadingButton>
          </>
        }
      >
        <form id="conversion-form" action={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label htmlFor={`${formId}-selectedItemId`} className="block text-sm font-medium text-gray-700 mb-1">Hàng Hóa</label>
            <SearchableSelect
              id={`${formId}-selectedItemId`}
              options={itemOptions}
              value={selectedItemId}
              onChange={setSelectedItemId}
              placeholder="Chọn hàng hóa..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`${formId}-selectedUnitName`} className="block text-sm font-medium text-gray-700 mb-1">Đơn vị mua</label>
              <SearchableSelect
                id={`${formId}-selectedUnitName`}
                options={unitOptions}
                value={selectedUnitName}
                onChange={setSelectedUnitName}
                placeholder="VD: Thùng 24 lon"
              />
            </div>
            <div>
              <label htmlFor={`${formId}-conversionRate`} className="block text-sm font-medium text-gray-700 mb-1">Tỷ lệ quy đổi</label>
              <input
                id={`${formId}-conversionRate`}
                type="number"
                step="any"
                required
                value={conversionRate}
                onChange={(e) => setConversionRate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 text-gray-900"
                placeholder="Số lượng trong 1 đơn vị mua"
              />
            </div>
          </div>

          {baseUnit && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">Quy đổi sang đơn vị cơ bản</div>
              <div className="text-sm font-medium text-blue-900">
                1 {selectedUnitName || "..."} = <span className="font-bold text-blue-600">{conversionRate || "0"}</span> {baseUnit.name}
              </div>
              <div className="text-[10px] text-blue-500 mt-1 italic">
                (Dựa trên nguyên liệu: {baseIngredient?.name})
              </div>
            </div>
          )}

          {isEdit && (
            <div className="flex items-start gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
              <input
                type="checkbox"
                id={`${formId}-update_history`}
                checked={updateHistory}
                onChange={(e) => setUpdateHistory(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              />
              <label htmlFor={`${formId}-update_history`} className="text-xs text-orange-800 leading-tight">
                Cập nhật đơn vị mua cho các đơn hàng cũ của mặt hàng này nếu đơn vị mua thay đổi.
              </label>
            </div>
          )}
        </form>
      </FormModal>
    </>
  );
}
