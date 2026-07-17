"use client";

import { useState } from "react";
import { addBaseIngredient, updateBaseIngredient } from "@/app/admin/inventory/actions";
import { SearchableSelect } from "../SearchableSelect";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { alert, confirm } from "@/lib/dialog";

export function BaseIngredientForm({ initialData, units = [] }: { initialData?: any; units?: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  const initialBaseUnitName = isEdit
    ? units.find((u: any) => u.id === initialData?.base_unit)?.name || initialData?.base_unit
    : "";

  const [items, setItems] = useState([
    {
      name: initialData?.name || "",
      base_unit: initialBaseUnitName,
      is_non_inventory: initialData?.is_non_inventory === "TRUE",
    },
  ]);

  async function handleSubmit(formData: FormData) {
    // Validate unit against strict list
    const inputUnit = items[0].base_unit;
    const unitObj = units.find((u) => u.name.toLowerCase() === inputUnit.toLowerCase());
    if (!unitObj) {
      await alert({ title: "Thiếu thông tin", message: `Đơn vị '${inputUnit}' không hợp lệ. Vui lòng chọn từ danh sách gợi ý hoặc yêu cầu Admin thêm mới.`, variant: "warning" });
      return;
    }

    setLoading(true);
    if (isEdit) {
      formData.append("id", initialData.id);
      formData.append("name", items[0].name);
      formData.append("base_unit", unitObj.id);
      formData.append("is_non_inventory", items[0].is_non_inventory ? "true" : "false");
      await updateBaseIngredient(formData);
    } else {
      const payloadItems = [{ ...items[0], base_unit: unitObj.id }];
      formData.append("items_json", JSON.stringify(payloadItems));
      await addBaseIngredient(formData);
    }
    setLoading(false);
    setIsOpen(false);
    if (!isEdit) setItems([{ name: "", base_unit: "", is_non_inventory: false }]);
  }

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const addItemRow = () => setItems([...items, { name: "", base_unit: "", is_non_inventory: false }]);
  const removeItemRow = (index: number) => setItems(items.filter((_, i) => i !== index));

  const handleClose = () => {
    setIsOpen(false);
    if (isEdit) {
      setItems([
        {
          name: initialData?.name || "",
          base_unit: initialBaseUnitName,
          is_non_inventory: initialData?.is_non_inventory === "TRUE",
        },
      ]);
    } else {
      setItems([{ name: "", base_unit: "", is_non_inventory: false }]);
    }
  };

  return (
    <>
      {isEdit ? (
        <button onClick={() => setIsOpen(true)} className="text-primary hover:text-primary text-sm font-medium">
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-success text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
        >
          + Nhóm Nguyên Liệu Gốc
        </button>
      )}

      {isOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
            <div className="bg-surface-card rounded-2xl p-6 w-full max-w-2xl shadow-xl">
              <h2 className="text-lg font-bold mb-4">{isEdit ? "Sửa Nguyên Liệu" : "Thêm Nguyên Liệu Gốc"}</h2>
              <form action={handleSubmit} className="space-y-4">
                <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[1.5fr_1fr_auto] gap-3 items-start p-4 border border-border bg-page rounded-xl relative"
                    >
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">
                          Tên Nguyên Liệu (VD: Sữa tươi)
                        </label>
                        <input
                          type="text"
                          required
                          value={item.name}
                          onChange={(e) => updateItem(index, "name", e.target.value)}
                          className="w-full border border-border rounded-lg px-3 py-2"
                        />
                        <label className="flex items-center gap-2 mt-2 text-sm text-text-secondary cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.is_non_inventory}
                            onChange={(e) => updateItem(index, "is_non_inventory", e.target.checked)}
                            className="w-4 h-4 text-success rounded border-border focus:ring-emerald-500"
                          />
                          <span>Không trừ tồn kho (Nước lọc, đá...)</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">Đơn vị gốc (VD: ml, gram)</label>
                        <SearchableSelect
                          required
                          value={item.base_unit}
                          onChange={(val) => updateItem(index, "base_unit", val)}
                          options={units.map((u: any) => ({ id: u.name, label: u.name }))}
                          placeholder="-- Gõ tìm đơn vị --"
                        />
                      </div>
                      {!isEdit && items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="px-3 py-2 mt-6 text-danger hover:bg-danger/10 rounded-lg"
                        >
                          Xoá
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {!isEdit && (
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="text-success text-sm font-medium hover:text-success"
                  >
                    + Thêm dòng khác
                  </button>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg text-sm"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-success text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50"
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
