"use client";

import { useState } from "react";
import { addItemCategory, updateItemCategory, addBaseIngredient, updateBaseIngredient, addPurchasedItem, updatePurchasedItem, addConversion, updateConversion } from "@/app/admin/inventory/actions";
import { SearchableSelect } from "./SearchableSelect";
import { ModalPortal } from "@/components/ui/ModalPortal";

// --- ITEM CATEGORY FORM (Nhóm Hàng Hoá) ---
export function ItemCategoryForm({ initialData }: { initialData?: any }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    if (isEdit) {
      formData.append("id", initialData.id);
      await updateItemCategory(formData);
    } else {
      await addItemCategory(formData);
    }
    setLoading(false);
    setIsOpen(false);
  }

  return (
    <>
      {isEdit ? (
        <button onClick={() => setIsOpen(true)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Sửa</button>
      ) : (
        <button onClick={() => setIsOpen(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          + Phân loại Hàng Hoá
        </button>
      )}
      
      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">{isEdit ? "Sửa Phân Loại" : "Tạo Phân Loại Hàng Hoá"}</h2>
            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Phân Loại (VD: Nguyên liệu khô, Bao bì)</label>
                <input type="text" name="name" defaultValue={initialData?.name} required className="w-full border border-gray-300 rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Đặc tính (System Type)</label>
                <select name="system_type" defaultValue={initialData?.system_type} className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="RAW">Thuộc nhóm Nguyên liệu (Có tính quy đổi, có trong công thức)</option>
                  <option value="CONSUMABLE">Thuộc nhóm Vật tư (Kiểm kê định kỳ)</option>
                  <option value="EQUIPMENT">Thuộc nhóm Dụng cụ</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Huỷ</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">Lưu</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}

// --- BASE INGREDIENT FORM (Nhóm Nguyên Liệu) ---
export function BaseIngredientForm({ initialData, units = [] }: { initialData?: any, units?: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;
  
  const initialBaseUnitName = isEdit 
    ? units.find((u: any) => u.id === initialData?.base_unit)?.name || initialData?.base_unit 
    : "";
    
  const [items, setItems] = useState([{ 
    name: initialData?.name || "", 
    base_unit: initialBaseUnitName,
    is_non_inventory: initialData?.is_non_inventory === "TRUE" 
  }]);

  async function handleSubmit(formData: FormData) {
    // Validate unit against strict list
    const inputUnit = items[0].base_unit;
    const unitObj = units.find(u => u.name.toLowerCase() === inputUnit.toLowerCase());
    if (!unitObj) {
      alert(`Đơn vị '${inputUnit}' không hợp lệ. Vui lòng chọn từ danh sách gợi ý hoặc yêu cầu Admin thêm mới.`);
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
      setItems([{ 
        name: initialData?.name || "", 
        base_unit: initialBaseUnitName,
        is_non_inventory: initialData?.is_non_inventory === "TRUE"
      }]);
    } else {
      setItems([{ name: "", base_unit: "", is_non_inventory: false }]);
    }
  };

  return (
    <>
      {isEdit ? (
        <button onClick={() => setIsOpen(true)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Sửa</button>
      ) : (
        <button onClick={() => setIsOpen(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition">
          + Nhóm Nguyên Liệu Gốc
        </button>
      )}
      
      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl">
            <h2 className="text-lg font-bold mb-4">{isEdit ? "Sửa Nguyên Liệu" : "Thêm Nguyên Liệu Gốc"}</h2>
            <form action={handleSubmit} className="space-y-4">
              <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1.5fr_1fr_auto] gap-3 items-start p-4 border border-gray-100 bg-gray-50 rounded-xl relative">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tên Nguyên Liệu (VD: Sữa tươi)</label>
                      <input type="text" required value={item.name} onChange={(e) => updateItem(index, "name", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                      <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={item.is_non_inventory} onChange={(e) => updateItem(index, "is_non_inventory", e.target.checked)} className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                        <span>Không trừ tồn kho (Nước lọc, đá...)</span>
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị gốc (VD: ml, gram)</label>
                      <SearchableSelect
                        required
                        value={item.base_unit}
                        onChange={(val) => updateItem(index, "base_unit", val)}
                        options={units.map((u: any) => ({ id: u.name, label: u.name }))}
                        placeholder="-- Gõ tìm đơn vị --"
                      />
                    </div>
                    {!isEdit && items.length > 1 && (
                      <button type="button" onClick={() => removeItemRow(index)} className="px-3 py-2 mt-6 text-red-500 hover:bg-red-50 rounded-lg">
                        Xoá
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isEdit && (
                <button type="button" onClick={addItemRow} className="text-emerald-600 text-sm font-medium hover:text-emerald-700">
                  + Thêm dòng khác
                </button>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={handleClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Huỷ</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">Lưu</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}

export function PurchasedItemForm({ 
  itemCategories, 
  baseIngredients, 
  initialData, 
  initialConversions,
  units = []
}: { 
  itemCategories: any[], 
  baseIngredients: any[], 
  initialData?: any,
  initialConversions?: any[],
  units?: any[]
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;
  
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialData?.item_category_id || "");
  const selectedCategory = itemCategories.find(c => c.id === selectedCategoryId);
  const isRaw = selectedCategory?.system_type === "RAW";

  const [selectedBaseIngredientId, setSelectedBaseIngredientId] = useState(initialData?.base_ingredient_id || "");
  const selectedBaseIngredient = baseIngredients.find(b => b.id === selectedBaseIngredientId);
  const baseUnitId = selectedBaseIngredient?.base_unit || "";
  const baseUnitName = units.find((u: any) => u.id === baseUnitId)?.name || baseUnitId;

  // Initialize units from initialConversions if edit mode
  const initialUnits = initialConversions?.length 
    ? initialConversions.map(c => ({ 
        id: c.id, 
        name: units.find((u: any) => u.id === c.purchased_unit)?.name || c.purchased_unit, 
        conversion_rate: c.conversion_rate 
      }))
    : [{ name: "", conversion_rate: "" }];

  const [unitsState, setUnitsState] = useState(initialUnits);

  async function handleSubmit(formData: FormData) {
    // Validate strict units for all input rows
    if (isRaw && unitsState.length > 0) {
      for (let i = 0; i < unitsState.length; i++) {
        const inputUnit = unitsState[i].name;
        const unitObj = units.find(u => u.name.toLowerCase() === inputUnit.toLowerCase());
        if (!unitObj) {
          alert(`Đơn vị '${inputUnit}' ở dòng ${i+1} không hợp lệ. Vui lòng chọn từ danh sách.`);
          return;
        }
      }
    }

    setLoading(true);
    if (isRaw && unitsState.length > 0) {
      const payloadUnits = unitsState.map(u => ({
        ...u,
        name: units.find(dbUnit => dbUnit.name.toLowerCase() === u.name.toLowerCase())?.id || u.name
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
        <button onClick={() => setIsOpen(true)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Sửa</button>
      ) : (
        <button onClick={() => setIsOpen(true)} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên Hàng Mua (VD: Thùng Sữa Vinamilk)</label>
                <input type="text" name="name" defaultValue={initialData?.name} required className="w-full border border-gray-300 rounded-lg px-3 py-2" />
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
                  {itemCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.system_type})</option>
                  ))}
                </select>
              </div>

              {isRaw && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-900 mb-1">Nguyên Liệu Gốc</label>
                    <p className="text-xs text-blue-700 mb-2">Vui lòng trỏ nó về đúng Nguyên liệu gốc để dùng trong Công thức.</p>
                    <SearchableSelect
                      name="base_ingredient_id"
                      required
                      value={selectedBaseIngredientId}
                      onChange={(val) => setSelectedBaseIngredientId(val)}
                      options={baseIngredients.map(b => ({
                        id: b.id,
                        label: `${b.name} (${units.find((u: any) => u.id === b.base_unit)?.name || b.base_unit})`
                      }))}
                      placeholder="-- Gõ để tìm Nguyên Liệu Gốc --"
                    />
                  </div>

                  {selectedBaseIngredientId && (
                    <div className="pt-2 border-t border-blue-200">
                      <label className="block text-sm font-bold text-blue-900 mb-2">Đơn Vị Mua (Có thể nhập nhiều)</label>
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
                              <input type="number" step="0.01" required value={u.conversion_rate} onChange={(e) => updateUnit(index, "conversion_rate", e.target.value)} className="w-full border border-blue-200 rounded-lg px-3 py-2" placeholder={`1 ... = ? ${baseUnitName}`} />
                            </div>
                            {unitsState.length > 1 && (
                              <button type="button" onClick={() => removeUnitRow(index)} className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg mb-[1px]">Xoá</button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={addUnitRow} className="mt-3 text-indigo-600 text-sm font-medium hover:text-indigo-800 flex items-center gap-1">
                        <span>+ Thêm đơn vị mua khác</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isEdit && (
                <label className="flex items-center gap-2 mt-4 text-sm text-indigo-800 bg-indigo-50 p-3 rounded-lg border border-indigo-100 cursor-pointer">
                  <input type="checkbox" name="update_history" value="true" defaultChecked className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                  <span className="font-medium">Đồng bộ thay đổi đơn vị cho toàn bộ Phiếu Nhập Kho cũ (Khuyên dùng)</span>
                </label>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={handleClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Huỷ</button>
                <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">Lưu</button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}

// --- CONVERSION FORM ---
export function ConversionForm({ items, baseIngredients, initialData, units = [] }: { items: any[], baseIngredients: any[], initialData?: any, units?: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = !!initialData;
  const [selectedItemId, setSelectedItemId] = useState(initialData?.purchased_item_id || "");

  // Only allow items that have base_ingredient_id
  const convertibleItems = items.filter(i => i.base_ingredient_id);

  const selectedItem = convertibleItems.find(i => i.id === selectedItemId);
  const baseIngredient = selectedItem ? baseIngredients.find(b => b.id === selectedItem.base_ingredient_id) : null;
  const baseUnitId = baseIngredient?.base_unit || "";
  const baseUnitName = units.find(u => u.id === baseUnitId)?.name || baseUnitId;
  
  const initialPurchasedUnitName = isEdit ? units.find(u => u.id === initialData?.purchased_unit)?.name || initialData.purchased_unit : "";
  const [selectedUnit, setSelectedUnit] = useState(initialPurchasedUnitName);

  async function handleSubmit(formData: FormData) {
    const inputUnit = selectedUnit;
    const unitObj = units.find(u => u.name.toLowerCase() === inputUnit.toLowerCase());
    if (!unitObj) {
      alert(`Đơn vị '${inputUnit}' không hợp lệ. Vui lòng chọn từ danh sách.`);
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
        <button onClick={() => setIsOpen(true)} className="text-blue-500 hover:text-blue-700 text-sm font-medium">Sửa</button>
      ) : (
        <button onClick={() => setIsOpen(true)} className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-purple-700 transition">
          + Thêm Quy đổi
        </button>
      )}
      
      {isOpen && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-lg font-bold mb-4">{isEdit ? "Sửa Quy Đổi" : "Tạo Quy Đổi Đơn Vị"}</h2>
            <form action={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hàng Mua Vào (Chỉ hiển thị mặt hàng thuộc Nguyên Liệu)</label>
                <select 
                  name="purchased_item_id" 
                  required 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                >
                  <option value="">-- Chọn Hàng Hoá --</option>
                  {convertibleItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>

              {selectedItemId && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị mua (Bao, Thùng)</label>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hệ số quy đổi</label>
                      <input type="number" step="0.01" name="conversion_rate" defaultValue={initialData?.conversion_rate} required className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="VD: 12000" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị gốc (Base Unit)</label>
                    <input type="text" readOnly value={baseUnitName} className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 text-gray-500" />
                  </div>
                  <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                    💡 1 [Đơn vị mua] = [Hệ số] {baseUnitName}
                  </div>
                </>
              )}

              {isEdit && (
                <label className="flex items-center gap-2 mt-4 text-sm text-indigo-800 bg-indigo-50 p-3 rounded-lg border border-indigo-100 cursor-pointer">
                  <input type="checkbox" name="update_history" value="true" defaultChecked className="w-4 h-4 text-indigo-600 rounded border-indigo-300 focus:ring-indigo-500" />
                  <span className="font-medium">Đồng bộ thay đổi đơn vị cho toàn bộ Phiếu Nhập Kho cũ (Khuyên dùng)</span>
                </label>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Huỷ</button>
                <button type="submit" disabled={loading || !selectedItemId} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50">Lưu</button>
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

// Reusable Action Group (Sửa / Xoá)
export function ActionGroup({ 
  id, 
  deleteFn, 
  onEdit 
}: { 
  id: string, 
  deleteFn: any,
  onEdit?: () => void 
}) {
  const [loading, setLoading] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const performDelete = async () => {
    setLoading(true);
    const fd = new FormData(); fd.append("id", id);
    const res = await deleteFn(fd);
    setLoading(false);
    if (res?.error) {
      alert("Lỗi: " + res.error);
    } else {
      setIsDeleteOpen(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-3">
      {onEdit && (
        <button 
          onClick={onEdit}
          className="text-blue-500 hover:text-blue-700 text-sm font-medium"
        >
          Sửa
        </button>
      )}
      <button 
        type="button"
        onClick={() => setIsDeleteOpen(true)}
        disabled={loading}
        className="text-red-500 hover:text-red-700 text-sm font-medium"
      >
        {loading ? "..." : "Xoá"}
      </button>
      </div>

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
                Bạn có chắc chắn muốn xoá mục này không?<br/>
                Thao tác này không thể hoàn tác.
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button type="button" onClick={() => setIsDeleteOpen(false)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">
                Huỷ
              </button>
              <button 
                type="button" 
                onClick={performDelete} 
                disabled={loading} 
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 disabled:opacity-50 transition shadow-sm"
              >
                {loading ? "Đang xử lý..." : "Xác nhận xoá"}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </>
  );
}

// Reusable Delete Button (Backward compatibility if needed)
export function DeleteBtn({ id, actionFn }: { id: string, actionFn: any }) {
  return <ActionGroup id={id} deleteFn={actionFn} />;
}
