"use client";

import { useState } from "react";
import { addPurchasedItem, updatePurchasedItem } from "@/app/admin/inventory/actions";
import { SearchableSelect } from "../SearchableSelect";
import { ModalPortal } from "@/components/ui/ModalPortal";

export function PurchasedItemForm({
  itemCategories,
  baseIngredients,
  initialData,
  initialConversions,
  units = [],
}: {
  itemCategories: any[];
  baseIngredients: any[];
  initialData?: any;
  initialConversions?: any[];
  units?: any[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  const [selectedCategoryId, setSelectedCategoryId] = useState(initialData?.item_category_id || "");
  const selectedCategory = itemCategories.find((c) => c.id === selectedCategoryId);
  const isRaw = selectedCategory?.system_type === "RAW";

  const [selectedBaseIngredientId, setSelectedBaseIngredientId] = useState(initialData?.base_ingredient_id || "");
  const selectedBaseIngredient = baseIngredients.find((b) => b.id === selectedBaseIngredientId);
  const baseUnitId = selectedBaseIngredient?.base_unit || "";
  const baseUnitName = units.find((u: any) => u.id === baseUnitId)?.name || baseUnitId;

  // Initialize units from initialConversions if edit mode
  const initialUnits = initialConversions?.length
    ? initialConversions.map((c) => ({
        id: c.id,
        name: units.find((u: any) => u.id === c.purchased_unit)?.name || c.purchased_unit,
        conversion_rate: c.conversion_rate,
      }))
    : [{ name: "", conversion_rate: "" }];

  const [unitsState, setUnitsState] = useState(initialUnits);

  async function handleSubmit(formData: FormData) {
    // Validate strict units for all input rows
    if (isRaw && unitsState.length > 0) {
      for (let i = 0; i < unitsState.length; i++) {
        const inputUnit = unitsState[i].name;
        const unitObj = units.find((u) => u.name.toLowerCase() === inputUnit.toLowerCase());
        if (!unitObj) {
          alert(`Đơn vị '${inputUnit}' ở dòng ${i + 1} không hợp lệ. Vui lòng chọn từ danh sách.`);
          return;
        }
      }
    }

    setLoading(true);
    if (isRaw && unitsState.length > 0) {
      const payloadUnits = unitsState.map((u) => ({
        ...u,
        name: units.find((dbUnit) => dbUnit.name.toLowerCase() === u.name.toLowerCase())?.id || u.name,
      }));
      formData.append("units_json", JSON.stringify(payloadUnits));
      formData.append("base_unit", baseUnitId);
    }

    if (isEdit) {
      formData.append("id", initialData.id);
      await updatePurchasedItem(formData);
    } else {
      await addPurchasedItem(formData);
    }
    setLoading(false);
    setIsOpen(false);
    if (!isEdit) setUnitsState([{ name: "", conversion_rate: "" }]);
  }

  const updateUnit = (index: number, field: string, value: string) => {
    const newUnits = [...unitsState];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setUnitsState(newUnits);
  };

  const addUnitRow = () => setUnitsState([...unitsState, { name: "", conversion_rate: "" }]);
  const removeUnitRow = (index: number) => setUnitsState(unitsState.filter((_, i) => i !== index));

  const handleClose = () => {
    setIsOpen(false);
    if (isEdit) {
      setSelectedCategoryId(initialData?.item_category_id || "");
      setSelectedBaseIngredientId(initialData?.base_ingredient_id || "");
      setUnitsState(initialUnits);
    } else {
      setSelectedCategoryId("");
      setSelectedBaseIngredientId("");
      setUnitsState([{ name: "", conversion_rate: "" }]);
    }
  };

  return (
    <>
      {isEdit ? (
        <button onClick={() => setIsOpen(true)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
        >
          + Thêm Hàng Mua Vào
        </button>
      )}

      {isOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">{isEdit ? "Sửa Hàng Mua Vào" : "Thêm Hàng Mua Vào"}</h2>
              <form action={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên Hàng Mua (VD: Thùng Sữa Vinamilk)
                  </label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={initialData?.name}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phân loại Hàng Hoá</label>
                  <select
                    name="item_category_id"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                  >
                    <option value="">-- Chọn --</option>
                    {itemCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.system_type})
                      </option>
                    ))}
                  </select>
                </div>

                {isRaw && (
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-blue-900 mb-1">Nguyên Liệu Gốc</label>
                      <p className="text-xs text-blue-700 mb-2">
                        Vui lòng trỏ nó về đúng Nguyên liệu gốc để dùng trong Công thức.
                      </p>
                      <SearchableSelect
                        name="base_ingredient_id"
                        required
                        value={selectedBaseIngredientId}
                        onChange={(val) => setSelectedBaseIngredientId(val)}
                        options={baseIngredients.map((b) => ({
                          id: b.id,
                          label: `${b.name} (${units.find((u: any) => u.id === b.base_unit)?.name || b.base_unit})`,
                        }))}
                        placeholder="-- Gõ để tìm Nguyên Liệu Gốc --"
                      />
                    </div>

                    {selectedBaseIngredientId && (
                      <div className="pt-2 border-t border-blue-200">
                        <label className="block text-sm font-bold text-blue-900 mb-2">
                          Đơn Vị Mua (Có thể nhập nhiều)
                        </label>
                        <div className="space-y-3">
                          {unitsState.map((u: any, index: number) => (
                            <div key={index} className="flex gap-2 items-end">
                              <div className="flex-1">
                                <label className="block text-xs text-blue-800 mb-1">Đơn vị (Hộp, Thùng)</label>
                                <SearchableSelect
                                  required
                                  value={u.name}
                                  onChange={(val) => updateUnit(index, "name", val)}
                                  options={units.map((unit: any) => ({ id: unit.name, label: unit.name }))}
                                  placeholder="Tìm..."
                                />
                              </div>
                              <div className="flex-1">
                                <label className="block text-xs text-blue-800 mb-1">Quy đổi ra {baseUnitName}</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  required
                                  value={u.conversion_rate}
                                  onChange={(e) => updateUnit(index, "conversion_rate", e.target.value)}
                                  className="w-full border border-blue-200 rounded-lg px-3 py-2"
                                  placeholder={`1 ... = ? ${baseUnitName}`}
                                />
                              </div>
                              {unitsState.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeUnitRow(index)}
                                  className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg mb-[1px]"
                                >
                                  Xoá
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={addUnitRow}
                          className="mt-3 text-indigo-600 text-sm font-medium hover:text-indigo-800 flex items-center gap-1"
                        >
                          <span>+ Thêm đơn vị mua khác</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {isEdit && (
                  <label className="flex items-center gap-2 mt-4 text-sm text-indigo-800 bg-indigo-50 p-3 rounded-lg border border-indigo-100 cursor-pointer">
                    <input
                      type="checkbox"
                      name="update_history"
                      value="true"
                      defaultChecked
                      className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500"
                    />
                    <span className="font-medium">
                      Đồng bộ thay đổi đơn vị cho toàn bộ Phiếu Nhập Kho cũ (Khuyên dùng)
                    </span>
                  </label>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Lưu
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
