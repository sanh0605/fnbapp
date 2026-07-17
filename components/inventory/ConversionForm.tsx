"use client";

import { useState } from "react";
import { addConversion, updateConversion } from "@/app/admin/inventory/actions";
import { SearchableSelect } from "../SearchableSelect";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { alert, confirm } from "@/lib/dialog";

export function ConversionForm({
  items,
  baseIngredients,
  initialData,
  units = [],
}: {
  items: any[];
  baseIngredients: any[];
  initialData?: any;
  units?: any[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;
  const [selectedItemId, setSelectedItemId] = useState(initialData?.purchased_item_id || "");

  // Only allow items that have base_ingredient_id
  const convertibleItems = items.filter((i) => i.base_ingredient_id);

  const selectedItem = convertibleItems.find((i) => i.id === selectedItemId);
  const baseIngredient = selectedItem ? baseIngredients.find((b) => b.id === selectedItem.base_ingredient_id) : null;
  const baseUnitId = baseIngredient?.base_unit || "";
  const baseUnitName = units.find((u) => u.id === baseUnitId)?.name || baseUnitId;

  const initialPurchasedUnitName = isEdit
    ? units.find((u) => u.id === initialData?.purchased_unit)?.name || initialData.purchased_unit
    : "";
  const [selectedUnit, setSelectedUnit] = useState(initialPurchasedUnitName);

  async function handleSubmit(formData: FormData) {
    const inputUnit = selectedUnit;
    const unitObj = units.find((u) => u.name.toLowerCase() === inputUnit.toLowerCase());
    if (!unitObj) {
      await alert({ title: "Thiếu thông tin", message: `Đơn vị '${inputUnit}' không hợp lệ. Vui lòng chọn từ danh sách.`, variant: "warning" });
      return;
    }

    setLoading(true);
    formData.set("purchased_unit", unitObj.id);
    formData.set("base_unit", baseUnitId);

    if (isEdit) {
      formData.append("id", initialData.id);
      await updateConversion(formData);
    } else {
      await addConversion(formData);
    }
    setLoading(false);
    setIsOpen(false);
  }

  return (
    <>
      {isEdit ? (
        <button onClick={() => setIsOpen(true)} className="text-primary hover:text-primary text-sm font-medium">
          Sửa
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-processing text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition"
        >
          + Thêm Quy đổi
        </button>
      )}

      {isOpen && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
            <div className="bg-surface-card rounded-2xl p-6 w-full max-w-md shadow-xl">
              <h2 className="text-lg font-bold mb-4">{isEdit ? "Sửa Quy Đổi" : "Tạo Quy Đổi Đơn Vị"}</h2>
              <form action={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Hàng Mua Vào (Chỉ hiển thị mặt hàng thuộc Nguyên Liệu)
                  </label>
                  <select
                    name="purchased_item_id"
                    required
                    className="w-full border border-border rounded-lg px-3 py-2"
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                  >
                    <option value="">-- Chọn Hàng Hoá --</option>
                    {convertibleItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedItemId && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">Đơn vị mua (Bao, Thùng)</label>
                        <SearchableSelect
                          required
                          name="purchased_unit"
                          value={selectedUnit}
                          onChange={(val) => setSelectedUnit(val)}
                          options={units.map((u: any) => ({ id: u.name, label: u.name }))}
                          placeholder="Tìm đơn vị..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">Hệ số quy đổi</label>
                        <input
                          type="number"
                          step="0.01"
                          name="conversion_rate"
                          defaultValue={initialData?.conversion_rate}
                          required
                          className="w-full border border-border rounded-lg px-3 py-2"
                          placeholder="VD: 12000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-1">Đơn vị gốc (Base Unit)</label>
                      <input
                        type="text"
                        readOnly
                        value={baseUnitName}
                        className="w-full border border-border rounded-lg px-3 py-2 bg-page text-text-secondary"
                      />
                    </div>
                    <div className="text-sm text-primary bg-primary-soft p-2 rounded">
                      💡 1 [Đơn vị mua] = [Hệ số] {baseUnitName}
                    </div>
                  </>
                )}

                {isEdit && (
                  <label className="flex items-center gap-2 mt-4 text-sm text-indigo-800 bg-primary-soft p-3 rounded-lg border border-indigo-100 cursor-pointer">
                    <input
                      type="checkbox"
                      name="update_history"
                      value="true"
                      defaultChecked
                      className="w-4 h-4 text-primary rounded border-indigo-300 focus:ring-focus-ring"
                    />
                    <span className="font-medium">
                      Đồng bộ thay đổi đơn vị cho toàn bộ Phiếu Nhập Kho cũ (Khuyên dùng)
                    </span>
                  </label>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-4 py-2 text-text-secondary hover:bg-surface-secondary rounded-lg text-sm"
                  >
                    Huỷ
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !selectedItemId}
                    className="px-4 py-2 bg-processing text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
                  >
                    Lưu
                  </button>
                </div>

                <datalist id="units-list">
                  {units.map((u: any) => (
                    <option key={u.id} value={u.name} />
                  ))}
                </datalist>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
