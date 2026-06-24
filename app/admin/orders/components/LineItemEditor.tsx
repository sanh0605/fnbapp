"use client";

import { useState, useMemo } from "react";

export interface EditItem {
  product_id: string;
  product_name: string;
  variant_id: string;
  size_name: string;
  unit_price: number;
  qty: number;
  modifiers: any[];
  discount_amount: number;
  line_discount: number;
  line_manual_discount: number;
  discount_type: string;
}

function summarizeModifiers(modifiers: any[]): string {
  const grouped = new Map<string, { name: string; count: number }>();
  for (const modifier of modifiers) {
    const key = String(modifier.id || modifier.name || "");
    const current = grouped.get(key) || { name: modifier.name || key, count: 0 };
    current.count += 1;
    grouped.set(key, current);
  }
  return Array.from(grouped.values())
    .map(modifier => `${modifier.count > 1 ? `${modifier.count}x ` : ""}${modifier.name}`)
    .join(", ");
}

interface LineItemEditorProps {
  item: EditItem;
  idx: number;
  isEditing: boolean;
  variants: any[];
  groupedModifiers: Record<string, any[]>;
  onStartEdit: (idx: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: (idx: number, updatedFields: Partial<EditItem>) => void;
  onRemove: (idx: number) => void;
}

export function LineItemEditor({
  item,
  idx,
  isEditing,
  variants,
  groupedModifiers,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRemove,
}: LineItemEditorProps) {
  // Editing states (only active when isEditing is true)
  const [editQty, setEditQty] = useState(item.qty);
  const [editDiscount, setEditDiscount] = useState(item.discount_amount);
  const [editDiscountType, setEditDiscountType] = useState<"VND" | "PERCENT">(
    (item.discount_type as "VND" | "PERCENT") || "VND"
  );
  const [editVariantId, setEditVariantId] = useState<string>(item.variant_id);
  const [editModifiers, setEditModifiers] = useState<any[]>([...item.modifiers]);

  // Sync state if entering edit mode
  useMemo(() => {
    if (isEditing) {
      setEditQty(item.qty);
      setEditDiscount(item.discount_amount);
      setEditDiscountType((item.discount_type as "VND" | "PERCENT") || "VND");
      setEditVariantId(item.variant_id);
      setEditModifiers([...item.modifiers]);
    }
  }, [isEditing, item]);

  const editVariants = useMemo(() => {
    return variants.filter((v: any) => v.product_id === item.product_id);
  }, [variants, item.product_id]);

  const addModifierToEdit = (mod: any) => {
    setEditModifiers([...editModifiers, { id: mod.id, name: mod.name, price: Number(mod.price || 0) }]);
  };

  const removeModifierFromEdit = (mod: any) => {
    const idxMod = editModifiers.findIndex((m: any) => m.id === mod.id);
    if (idxMod !== -1) {
      setEditModifiers(editModifiers.filter((_, i) => i !== idxMod));
    }
  };

  const editTotals = useMemo(() => {
    const variant = editVariants.find((v: any) => v.id === editVariantId) || editVariants[0];
    const unitPrice = Number(variant?.price || item.unit_price);
    const modsPrice = editModifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0);
    const base = (unitPrice + modsPrice) * editQty;

    let manualDisc = 0;
    if (editDiscount > 0) {
      manualDisc = editDiscountType === "PERCENT" ? (base * editDiscount) / 100 : editDiscount;
    }

    const promoDisc =
      item.qty > 0 && editQty !== item.qty
        ? Math.round(Number(item.line_discount || 0) * (editQty / item.qty))
        : Number(item.line_discount || 0);

    return { base, final: Math.max(0, base - manualDisc - promoDisc) };
  }, [editQty, editDiscount, editDiscountType, editVariantId, editModifiers, editVariants, item.unit_price, item.line_discount, item.qty]);

  const handleSave = () => {
    const newVariant = editVariants.find((v: any) => v.id === editVariantId);
    let scaledLineDiscount = Number(item.line_discount || 0);
    if (item.qty > 0 && editQty !== item.qty) {
      const scale = editQty / item.qty;
      scaledLineDiscount = Math.round(scaledLineDiscount * scale);
    }

    onSaveEdit(idx, {
      qty: editQty,
      discount_amount: editDiscount,
      discount_type: editDiscountType,
      variant_id: editVariantId,
      size_name: newVariant?.size_name || item.size_name,
      unit_price: Number(newVariant?.price || item.unit_price),
      modifiers: [...editModifiers],
      line_discount: scaledLineDiscount,
    });
  };

  if (isEditing) {
    return (
      <div className="bg-indigo-50 p-3 rounded-xl border-2 border-indigo-200 space-y-3">
        <div className="font-bold text-gray-800">{item.product_name}</div>

        {/* Size selection */}
        {editVariants.length > 1 && (
          <div>
            <div className="text-xs font-medium text-gray-500 mb-1.5">Size</div>
            <div className="flex flex-wrap gap-2">
              {editVariants.map((v: any) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setEditVariantId(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    editVariantId === v.id
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {v.size_name} - {Number(v.price).toLocaleString("vi-VN")}d
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Topping editing */}
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1.5">Topping</div>
          <div className="space-y-2">
            {Object.entries(groupedModifiers).map(([groupName, mods]) => (
              <div key={groupName}>
                <div className="text-[11px] text-gray-400 mb-1">{groupName}</div>
                <div className="flex flex-wrap gap-1.5">
                  {mods.map((mod: any) => {
                    const count = editModifiers.filter((m: any) => m.id === mod.id).length;
                    return (
                      <div
                        key={mod.id}
                        className={`flex items-center gap-1 rounded-lg border text-xs ${
                          count > 0 ? "border-indigo-400 bg-indigo-50" : "border-gray-200 bg-white"
                        }`}
                      >
                        {count > 0 && (
                          <button
                            type="button"
                            onClick={() => removeModifierFromEdit(mod)}
                            className="px-1.5 py-1 text-indigo-400 hover:text-red-500 font-bold"
                          >
                            -
                          </button>
                        )}
                        <span className="px-1 py-1">
                          {mod.name} <span className="text-gray-400">+{Number(mod.price).toLocaleString("vi-VN")}d</span>
                        </span>
                        {count > 0 && <span className="px-1 py-1 font-bold text-indigo-600">{count}x</span>}
                        <button
                          type="button"
                          onClick={() => addModifierToEdit(mod)}
                          className="px-1.5 py-1 text-gray-400 hover:text-indigo-600 font-bold"
                        >
                          +
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Qty & Discount */}
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">SL:</span>
            <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-200">
              <button
                type="button"
                onClick={() => setEditQty(Math.max(1, editQty - 1))}
                className="w-7 h-7 flex items-center justify-center bg-white rounded border text-gray-600 font-bold"
              >
                -
              </button>
              <span className="font-bold w-6 text-center">{editQty}</span>
              <button
                type="button"
                onClick={() => setEditQty(editQty + 1)}
                className="w-7 h-7 flex items-center justify-center bg-white rounded border text-gray-600 font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium text-gray-700">Giảm:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 shrink-0">
              <button
                type="button"
                onClick={() => setEditDiscountType("VND")}
                className={`px-2 py-1 text-xs font-bold ${
                  editDiscountType === "VND" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"
                }`}
              >
                VND
              </button>
              <button
                type="button"
                onClick={() => setEditDiscountType("PERCENT")}
                className={`px-2 py-1 text-xs font-bold ${
                  editDiscountType === "PERCENT" ? "bg-orange-100 text-orange-700" : "bg-white text-gray-400"
                }`}
              >
                %
              </button>
            </div>
            <input
              type="number"
              min="0"
              value={editDiscount || ""}
              onChange={(e) => setEditDiscount(Number(e.target.value))}
              className="flex-1 px-2 py-1 border border-gray-200 rounded-lg text-sm text-right outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Price totals */}
        <div className="bg-white rounded-lg p-2.5 border border-indigo-100 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Giá gốc</span>
            <span className="text-gray-700 font-medium">{editTotals.base.toLocaleString("vi-VN")}đ</span>
          </div>
          {Number(item.line_discount || 0) > 0 && (
            <div className="flex justify-between text-sm text-emerald-600">
              <span>⚡ KM (tự scale theo SL)</span>
              <span>
                -
                {Math.round(
                  Number(item.line_discount || 0) * (item.qty > 0 ? editQty / item.qty : 1)
                ).toLocaleString("vi-VN")}
                đ
              </span>
            </div>
          )}
          {editDiscount > 0 && (
            <div className="flex justify-between text-sm text-red-500">
              <span>Chiết khấu</span>
              <span>
                -
                {(
                  editTotals.base -
                  editTotals.final -
                  (Number(item.line_discount || 0) > 0
                    ? Math.round(Number(item.line_discount || 0) * (item.qty > 0 ? editQty / item.qty : 1))
                    : 0)
                ).toLocaleString("vi-VN")}
                đ
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-1 border-t border-gray-100">
            <span className="text-gray-800">Thành tiền</span>
            <span className="text-orange-600">{editTotals.final.toLocaleString("vi-VN")}đ</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancelEdit}
            className="flex-1 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-1.5 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Lưu
          </button>
        </div>
      </div>
    );
  }

  // Preview Mode
  const modsPrice = item.modifiers.reduce((s: number, m: any) => s + Number(m.price || 0), 0);
  const baseTotal = (item.unit_price + modsPrice) * item.qty;

  let disc = 0;
  if (item.discount_amount > 0) {
    disc = item.discount_type === "PERCENT" ? (baseTotal * item.discount_amount) / 100 : item.discount_amount;
  }
  const lineTotal = Math.max(0, baseTotal - disc);

  return (
    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
      <div className="flex justify-between items-start mb-1">
        <div className="flex-1">
          <span className="font-bold text-orange-600 mr-1">{item.qty}x</span>
          <span className="font-bold text-gray-800">{item.product_name}</span>
          <span className="text-gray-400 text-xs ml-1">({item.size_name})</span>
        </div>
        <div className="text-right">
          {(item.discount_amount > 0 || item.line_discount > 0 || item.line_manual_discount > 0) && (
            <div className="text-[11px] text-gray-400 line-through">{baseTotal.toLocaleString("vi-VN")}d</div>
          )}
          <div className="font-bold text-gray-800">{lineTotal.toLocaleString("vi-VN")}d</div>
        </div>
      </div>
      {item.modifiers.length > 0 && (
        <div className="text-xs text-indigo-600 mb-1">+ {summarizeModifiers(item.modifiers)}</div>
      )}
      {item.line_discount > 0 && (
        <div className="text-xs text-emerald-600 font-medium mb-0.5">
          KM: -{item.line_discount.toLocaleString("vi-VN")}đ
        </div>
      )}
      {(item.discount_amount > 0 || item.line_manual_discount > 0) && (
        <div className="text-xs text-red-500 font-medium mb-1">
          Giảm: -
          {item.discount_type === "PERCENT"
            ? `${item.discount_amount}%`
            : `${Number(item.discount_amount || item.line_manual_discount).toLocaleString("vi-VN")}đ`}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={() => onStartEdit(idx)}
          className="text-xs font-medium text-indigo-600 px-2 py-1 bg-indigo-50 rounded hover:bg-indigo-100"
        >
          Sửa
        </button>
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="text-xs font-medium text-red-500 px-2 py-1 bg-red-50 rounded hover:bg-red-100"
        >
          Xóa
        </button>
      </div>
    </div>
  );
}
