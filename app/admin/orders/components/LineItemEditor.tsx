"use client";

import { useState, useMemo } from "react";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/Button";

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
  line_promo_discount: number;
  line_order_discount_allocation: number;
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
      line_promo_discount:
        item.qty > 0 && editQty !== item.qty
          ? Math.round(Number(item.line_promo_discount || 0) * (editQty / item.qty))
          : Number(item.line_promo_discount || 0),
      line_order_discount_allocation:
        item.qty > 0 && editQty !== item.qty
          ? Math.round(Number(item.line_order_discount_allocation || 0) * (editQty / item.qty))
          : Number(item.line_order_discount_allocation || 0),
    });
  };

  if (isEditing) {
    return (
      <div className="bg-primary-soft p-3 rounded-xl border border-primary/20 space-y-3">
        <div className="font-bold text-text-primary">{item.product_name}</div>

        {/* Size selection */}
        {editVariants.length > 1 && (
          <div>
            <div className="text-xs font-medium text-text-muted mb-1.5">Size</div>
            <div className="flex flex-wrap gap-2">
              {editVariants.map((v: any) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setEditVariantId(v.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    editVariantId === v.id
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-surface-card text-text-secondary hover:border-border-hover"
                  }`}
                >
                  {v.size_name} - {formatNumber(v.price)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Topping editing */}
        <div>
          <div className="text-xs font-medium text-text-muted mb-1.5">Topping</div>
          <div className="space-y-2">
            {Object.entries(groupedModifiers).map(([groupName, mods]) => (
              <div key={groupName}>
                <div className="text-[11px] text-text-muted mb-1">{groupName}</div>
                <div className="flex flex-wrap gap-1.5">
                  {mods.map((mod: any) => {
                    const count = editModifiers.filter((m: any) => m.id === mod.id).length;
                    return (
                      <div
                        key={mod.id}
                        className={`flex items-center gap-1 rounded-lg border text-xs ${
                          count > 0 ? "border-primary bg-primary-soft" : "border-border bg-surface-card"
                        }`}
                      >
                        {count > 0 && (
                          <button
                            type="button"
                            onClick={() => removeModifierFromEdit(mod)}
                            className="px-1.5 py-1 text-primary hover:text-danger font-bold"
                          >
                            -
                          </button>
                        )}
                        <span className="px-1 py-1 text-text-primary">
                          {mod.name} <span className="text-text-muted">+{formatNumber(mod.price)}</span>
                        </span>
                        {count > 0 && <span className="px-1 py-1 font-bold text-primary">{count}x</span>}
                        <button
                          type="button"
                          onClick={() => addModifierToEdit(mod)}
                          className="px-1.5 py-1 text-text-muted hover:text-primary font-bold"
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
            <span className="text-sm font-medium text-text-secondary">SL:</span>
            <div className="flex items-center gap-1 bg-surface-card rounded-lg p-1 border border-border">
              <button
                type="button"
                onClick={() => setEditQty(Math.max(1, editQty - 1))}
                className="w-7 h-7 flex items-center justify-center bg-surface-card rounded border border-border text-text-secondary font-bold hover:bg-page"
              >
                -
              </button>
              <span className="font-bold w-6 text-center text-text-primary">{editQty}</span>
              <button
                type="button"
                onClick={() => setEditQty(editQty + 1)}
                className="w-7 h-7 flex items-center justify-center bg-surface-card rounded border border-border text-text-secondary font-bold hover:bg-page"
              >
                +
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-sm font-medium text-text-secondary">Giảm:</span>
            <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
              <button
                type="button"
                onClick={() => setEditDiscountType("VND")}
                className={`px-2 py-1 text-xs font-bold ${
                  editDiscountType === "VND" ? "bg-primary-soft text-primary" : "bg-surface-card text-text-muted hover:bg-page"
                }`}
              >
                VND
              </button>
              <button
                type="button"
                onClick={() => setEditDiscountType("PERCENT")}
                className={`px-2 py-1 text-xs font-bold ${
                  editDiscountType === "PERCENT" ? "bg-primary-soft text-primary" : "bg-surface-card text-text-muted hover:bg-page"
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
              className="flex-1 px-2 py-1 border border-border rounded-lg text-sm text-right bg-surface-card text-text-primary outline-none focus:ring-1 focus:ring-focus-ring"
            />
          </div>
        </div>

        {/* Price totals */}
        <div className="bg-surface-card rounded-lg p-2.5 border border-border space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">Giá gốc</span>
            <span className="text-text-primary font-medium">{formatNumber(editTotals.base)}</span>
          </div>
          {Number(item.line_discount || 0) > 0 && (
            <div className="flex justify-between text-sm text-success">
              <span>⚡ KM (tự scale theo SL)</span>
              <span>
                -
                {formatNumber(Math.round(
                  Number(item.line_discount || 0) * (item.qty > 0 ? editQty / item.qty : 1)
                ))}
              </span>
            </div>
          )}
          {editDiscount > 0 && (
            <div className="flex justify-between text-sm text-danger">
              <span>Chiết khấu</span>
              <span>
                -
                {formatNumber(
                  editTotals.base -
                  editTotals.final -
                  (Number(item.line_discount || 0) > 0
                    ? Math.round(Number(item.line_discount || 0) * (item.qty > 0 ? editQty / item.qty : 1))
                    : 0)
                )}
              </span>
            </div>
          )}
          <div className="flex justify-between font-bold pt-1 border-t border-border">
            <span className="text-text-primary">Thành tiền</span>
            <span className="text-primary">{formatNumber(editTotals.final)}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="secondary"
            onClick={onCancelEdit}
            className="flex-1"
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            className="flex-1"
          >
            Lưu
          </Button>
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
    <div className="bg-page p-3 rounded-xl border border-border">
      <div className="flex justify-between items-start mb-1">
        <div className="flex-1">
          <span className="font-bold text-primary mr-1">{item.qty}x</span>
          <span className="font-bold text-text-primary">{item.product_name}</span>
          <span className="text-text-muted text-xs ml-1">({item.size_name})</span>
        </div>
        <div className="text-right">
          {(item.discount_amount > 0 || item.line_discount > 0 || item.line_manual_discount > 0) && (
            <div className="text-[11px] text-text-muted line-through">{formatNumber(baseTotal)}</div>
          )}
          <div className="font-bold text-text-primary">{formatNumber(lineTotal)}</div>
        </div>
      </div>
      {item.modifiers.length > 0 && (
        <div className="text-xs text-primary mb-1">+ {summarizeModifiers(item.modifiers)}</div>
      )}
      {item.line_discount > 0 && (
        <div className="text-xs text-success font-medium mb-0.5">
          KM: -{formatNumber(item.line_discount)}
        </div>
      )}
      {(item.discount_amount > 0 || item.line_manual_discount > 0) && (
        <div className="text-xs text-danger font-medium mb-1">
          Giảm: -
          {item.discount_type === "PERCENT"
            ? `${item.discount_amount}%`
            : `${formatNumber(Number(item.discount_amount || item.line_manual_discount))}`}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={() => onStartEdit(idx)}
          className="text-xs font-medium text-primary px-2 py-1 bg-primary-soft rounded hover:bg-primary-soft/80"
        >
          Sửa
        </button>
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="text-xs font-medium text-danger px-2 py-1 bg-danger/20 rounded hover:bg-danger/30"
        >
          Xóa
        </button>
      </div>
    </div>
  );
}
